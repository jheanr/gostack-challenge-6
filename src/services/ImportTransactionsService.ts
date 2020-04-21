import path from 'path';
import fs from 'fs';
import csvParser from 'csv-parse';

import { getCustomRepository, getRepository, In } from 'typeorm';
import uploadConfig from '../config/upload';

import Transaction from '../models/Transaction';
import TransactionsRepository from '../repositories/TransactionsRepository';
import Category from '../models/Category';

interface Request {
  fileName: string;
}

interface TransactionCSV {
  title: string;
  value: number;
  type: 'income' | 'outcome';
  category: string;
}

class ImportTransactionsService {
  async execute({ fileName }: Request): Promise<Transaction[]> {
    const transactionsRepository = getCustomRepository(TransactionsRepository);
    const categoriesRepository = getRepository(Category);

    const importTransactionsFile = path.join(uploadConfig.directory, fileName);

    const transactionsFromFile: TransactionCSV[] = [];
    const categoriesFromFile: string[] = [];

    const stream = fs.createReadStream(importTransactionsFile).pipe(
      csvParser({
        delimiter: ',',
        from_line: 2,
        columns: ['title', 'type', 'value', 'category'],
        trim: true,
      }),
    );

    stream.on('data', data => {
      categoriesFromFile.push(data.category);
      transactionsFromFile.push(data);
    });

    await new Promise(resolve => stream.on('end', resolve));

    const existentsCategories = await categoriesRepository.find({
      where: {
        title: In(categoriesFromFile),
      },
    });

    const existentsCategoriesTitles = existentsCategories.map(
      (category: Category) => category.title,
    );

    const addCategoriesTitles = categoriesFromFile
      .filter(category => !existentsCategoriesTitles.includes(category))
      .filter((value, index, self) => self.indexOf(value) === index);

    const newCategories = categoriesRepository.create(
      addCategoriesTitles.map(title => ({
        title,
      })),
    );

    await categoriesRepository.save(newCategories);

    const finalCategories = [...newCategories, ...existentsCategories];

    const transactions = transactionsRepository.create(
      transactionsFromFile.map(transaction => ({
        title: transaction.title,
        type: transaction.type,
        value: transaction.value,
        category: finalCategories.find(
          category => category.title === transaction.category,
        ),
      })),
    );

    await transactionsRepository.save(transactions);

    await fs.promises.unlink(importTransactionsFile);

    return transactions;
  }
}

export default ImportTransactionsService;
