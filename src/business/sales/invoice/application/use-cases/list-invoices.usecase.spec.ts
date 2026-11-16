import { ListInvoicesUseCase } from './list-invoices.usecase';
import { InvoiceQuery } from '../queries/invoice.query';
import { PageResult } from '@common/application/types/pagination';
import { InvoiceQueryRecord } from '../../domain/types/invoice.types';

describe('ListInvoicesUseCase', () => {
  const query = { findAll: jest.fn() };
  let usecase: ListInvoicesUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    usecase = new ListInvoicesUseCase(query as unknown as InvoiceQuery);
  });

  it('delegates to the query repository', async () => {
    const result = { items: [] } as unknown as PageResult<InvoiceQueryRecord>;
    query.findAll.mockResolvedValue(result);
    const page = { page: 1, pageSize: 20 };
    await expect(usecase.execute(page)).resolves.toBe(result);
    expect(query.findAll).toHaveBeenCalledWith(page);
  });
});
