import { NotFoundException } from '@nestjs/common';
import { GetInvoiceUseCase } from './get-invoice.usecase';
import { InvoiceQuery } from '../queries/invoice.query';
import { InvoiceQueryRecord } from '../../domain/types/invoice.types';

describe('GetInvoiceUseCase', () => {
  const query = { findById: jest.fn() };
  let usecase: GetInvoiceUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    usecase = new GetInvoiceUseCase(query as unknown as InvoiceQuery);
  });

  it('returns the invoice projection', async () => {
    const record = { id: 'inv-1' } as unknown as InvoiceQueryRecord;
    query.findById.mockResolvedValue(record);
    await expect(usecase.execute('inv-1')).resolves.toBe(record);
    expect(query.findById).toHaveBeenCalledWith('inv-1');
  });

  it('throws NotFound when the invoice does not exist', async () => {
    query.findById.mockResolvedValue(null);
    await expect(usecase.execute('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
