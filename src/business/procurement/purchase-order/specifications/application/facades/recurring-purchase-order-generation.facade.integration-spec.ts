import { RecurringPurchaseOrderGenerationFacade } from '@business/procurement/purchase-order/application/facades/recurring-purchase-order-generation.facade';
import { CreatePurchaseOrderUseCase } from '@business/procurement/purchase-order/application/use-cases/create-purchase-order.usecase';
import { AddPurchaseOrderLineUseCase } from '@business/procurement/purchase-order/application/use-cases/add-purchase-order-line.usecase';
import { GetPurchaseOrderUseCase } from '@business/procurement/purchase-order/application/use-cases/get-purchase-order.usecase';
import { SubmitPurchaseOrderUseCase } from '@business/procurement/purchase-order/application/use-cases/submit-purchase-order.usecase';
import { RecurringExecutionPort } from '@platform/platform-common/recurring/ports/recurring-execution.port';
import { LoggerPort } from '@platform/platform-common/observability/ports/logger.port';
import { initNoopTransactionHost } from '@test/utils/noop-transaction-host';

const idOf = (value: string) => ({ toString: () => value });

describe('RecurringPurchaseOrderGenerationFacade (integration)', () => {
  const create = { execute: jest.fn() };
  const addLine = { execute: jest.fn() };
  const get = { execute: jest.fn() };
  const submit = { execute: jest.fn() };
  const logger = { error: jest.fn() };
  let facade: RecurringPurchaseOrderGenerationFacade;

  beforeEach(() => {
    jest.clearAllMocks();
    initNoopTransactionHost();
    create.execute.mockResolvedValue(idOf('po-1'));
    get.execute.mockResolvedValue({ id: 'po-1', total: 10 });
    facade = new RecurringPurchaseOrderGenerationFacade(
      create as unknown as CreatePurchaseOrderUseCase,
      addLine as unknown as AddPurchaseOrderLineUseCase,
      get as unknown as GetPurchaseOrderUseCase,
      submit as unknown as SubmitPurchaseOrderUseCase,
      {} as RecurringExecutionPort,
      logger as unknown as LoggerPort,
    );
  });

  const lines = [{ productId: 'p-1', quantity: 2, unitPrice: 5 }];

  it('creates the order and its lines, then returns a snapshot', async () => {
    await expect(
      facade.generateRecurringPurchaseOrder('v-1', 'USD', lines, false),
    ).resolves.toEqual({
      purchaseOrderId: 'po-1',
      snapshot: { id: 'po-1', total: 10 },
    });
    expect(addLine.execute).toHaveBeenCalledWith({
      id: 'po-1',
      productId: 'p-1',
      quantity: 2,
      unitPrice: 5,
    });
    expect(submit.execute).not.toHaveBeenCalled();
  });

  it('auto-posts when requested and swallows submit failures', async () => {
    submit.execute.mockRejectedValue(new Error('not allowed'));
    await facade.generateRecurringPurchaseOrder('v-1', 'USD', lines, true);
    expect(submit.execute).toHaveBeenCalledWith('po-1');
    expect(logger.error).toHaveBeenCalled();
  });

  it('fails when the order cannot be read back', async () => {
    get.execute.mockResolvedValue(null);
    await expect(facade.generateRecurringPurchaseOrder('v-1', 'USD', lines, false)).rejects.toThrow(
      'could not be read back',
    );
  });

  it('rejects invalid lines before creating anything', async () => {
    await expect(facade.generateRecurringPurchaseOrder('v-1', 'USD', [], false)).rejects.toThrow();
    expect(create.execute).not.toHaveBeenCalled();
  });
});
