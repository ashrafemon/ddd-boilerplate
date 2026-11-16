import { RecurringInvoiceGenerationFacade } from '@business/sales/invoice/application/facades/recurring-invoice-generation.facade';
import { CreateInvoiceUseCase } from '@business/sales/invoice/application/use-cases/create-invoice.usecase';
import { GetInvoiceUseCase } from '@business/sales/invoice/application/use-cases/get-invoice.usecase';
import { PostInvoiceUseCase } from '@business/sales/invoice/application/use-cases/post-invoice.usecase';
import { RecurringExecutionPort } from '@platform/platform-common/recurring/ports/recurring-execution.port';
import { LoggerPort } from '@platform/platform-common/observability/ports/logger.port';
import { initNoopTransactionHost } from '@test/utils/noop-transaction-host';

describe('RecurringInvoiceGenerationFacade (integration)', () => {
  const create = { execute: jest.fn() };
  const get = { execute: jest.fn() };
  const post = { execute: jest.fn() };
  const logger = { error: jest.fn() };
  let facade: RecurringInvoiceGenerationFacade;

  beforeEach(() => {
    jest.clearAllMocks();
    initNoopTransactionHost();
    create.execute.mockResolvedValue('inv-1');
    get.execute.mockResolvedValue({ id: 'inv-1', totalAmount: 10 });
    facade = new RecurringInvoiceGenerationFacade(
      create as unknown as CreateInvoiceUseCase,
      get as unknown as GetInvoiceUseCase,
      post as unknown as PostInvoiceUseCase,
      {} as RecurringExecutionPort,
      logger as unknown as LoggerPort,
    );
  });

  const lines = [{ productId: 'p-1', description: 'Widget', quantity: 2, unitPrice: 5 }];

  it('creates the invoice and returns a snapshot', async () => {
    await expect(facade.generateRecurringInvoice('c-1', 'USD', lines, false)).resolves.toEqual({
      invoiceId: 'inv-1',
      snapshot: { id: 'inv-1', totalAmount: 10 },
    });
    expect(post.execute).not.toHaveBeenCalled();
  });

  it('auto-posts when requested and swallows post failures', async () => {
    post.execute.mockRejectedValue(new Error('not allowed'));
    await facade.generateRecurringInvoice('c-1', 'USD', lines, true);
    expect(post.execute).toHaveBeenCalledWith('inv-1');
    expect(logger.error).toHaveBeenCalled();
  });

  it('fails when the invoice cannot be read back', async () => {
    get.execute.mockResolvedValue(null);
    await expect(facade.generateRecurringInvoice('c-1', 'USD', lines, false)).rejects.toThrow(
      'could not be read back',
    );
  });

  it('rejects invalid lines before creating anything', async () => {
    await expect(facade.generateRecurringInvoice('c-1', 'USD', [], false)).rejects.toThrow();
    expect(create.execute).not.toHaveBeenCalled();
  });
});
