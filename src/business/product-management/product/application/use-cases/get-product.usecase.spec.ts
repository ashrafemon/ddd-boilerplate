import { NotFoundException } from '@nestjs/common';
import { GetProductUseCase } from './get-product.usecase';
import { ProductQuery } from '../queries/product.query';
import { ProductQueryRecord } from '../../domain/types/product.types';

describe('GetProductUseCase', () => {
  const query = { findById: jest.fn() };
  let usecase: GetProductUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    usecase = new GetProductUseCase(query as unknown as ProductQuery);
  });

  it('returns the product projection', async () => {
    const record = { id: 'p-1', name: 'Mouse' } as unknown as ProductQueryRecord;
    query.findById.mockResolvedValue(record);
    await expect(usecase.execute('p-1')).resolves.toBe(record);
    expect(query.findById).toHaveBeenCalledWith('p-1');
  });

  it('throws NotFound when the product does not exist', async () => {
    query.findById.mockResolvedValue(null);
    await expect(usecase.execute('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
