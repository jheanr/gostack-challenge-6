import path from 'path';
import fs from 'fs';
import csvParser from 'csv-parse';

import uploadConfig from '../config/upload';

import Transaction from '../models/Transaction';
import CreateTransactionService from './CreateTransactionService';
import AppError from '../errors/AppError';

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
    const createTransaction = new CreateTransactionService();

    const importTransactionsFile = path.join(uploadConfig.directory, fileName);

    const transactions: Transaction[] = [];
    const transactionsFromFile: TransactionCSV[] = [];

    const stream = fs.createReadStream(importTransactionsFile).pipe(
      csvParser({
        delimiter: ',',
        from_line: 2,
        columns: ['title', 'type', 'value', 'category'],
        trim: true,
      }),
    );

    stream.on('data', data => {
      transactionsFromFile.push(data);
    });

    await new Promise(resolve => {
      stream.on('end', resolve);
    });

    for (const transaction of transactionsFromFile) {
      const { title, value, type, category } = transaction;

      const newTransaction = await createTransaction.execute({
        title,
        value,
        type,
        category,
      });

      transactions.push(newTransaction);
    }

    if (transactions) {
      await fs.promises.unlink(importTransactionsFile);
    }

    return transactions;
  }
}

export default ImportTransactionsService;
