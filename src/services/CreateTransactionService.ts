import { getCustomRepository, getRepository } from 'typeorm';
import AppError from '../errors/AppError';

import Transaction from '../models/Transaction';
import TransactionsRepository from '../repositories/TransactionsRepository';
import Category from '../models/Category';

interface Request {
  title: string;
  value: number;
  type: 'income' | 'outcome';
  category: string;
}

class CreateTransactionService {
  public async execute({
    title,
    value,
    type,
    category,
  }: Request): Promise<Transaction> {
    const transactionsRepository = getCustomRepository(TransactionsRepository);
    const categoriesRepository = getRepository(Category);

    if (!type.match(/^(income|outcome)$/)) {
      throw new AppError('Invalid transaction type.');
    }

    const balance = await transactionsRepository.getBalance();

    if (type === 'outcome' && value > balance.total) {
      throw new AppError(
        'Outcome amount higher than balance. Try another value.',
      );
    }

    const checkCategoryExists = await categoriesRepository.findOne({
      where: { title: category },
    });

    let category_id = '';

    if (checkCategoryExists) {
      category_id = checkCategoryExists.id;
    } else {
      const newCategory = categoriesRepository.create({
        title: category,
      });

      await categoriesRepository.save(newCategory);

      category_id = newCategory.id;
    }

    const transaction = transactionsRepository.create({
      title,
      value,
      type,
      category_id,
    });

    await transactionsRepository.save(transaction);

    return transaction;
  }
}

export default CreateTransactionService;
