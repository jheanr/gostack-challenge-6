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

    await new Promise(() =>
      fs
        .createReadStream(importTransactionsFile)
        .pipe(
          csvParser({
            delimiter: ',',
            from_line: 2,
            columns: ['title', 'type', 'value', 'category'],
            trim: true,
          }),
        )
        .on('data', async (transaction: TransactionCSV) => {
          const { title, value, type, category } = transaction;

          const newTransaction = await createTransaction.execute({
            title,
            value,
            type,
            category,
          });

          transactions.push(newTransaction);
        })
        .on('end', () => {
          fs.promises.unlink(importTransactionsFile);
        })
        .on('error', err => {
          throw new AppError(err.message);
        }),
    );

    return transactions;
  }
}

export default ImportTransactionsService;
