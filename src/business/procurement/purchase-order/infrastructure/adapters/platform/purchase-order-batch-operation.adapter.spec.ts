import { PurchaseOrderBatchOperationAdapter } from './purchase-order-batch-operation.adapter';
import { GetPurchaseOrderUseCase } from '../../../application/use-cases/get-purchase-order.usecase';
import { SubmitPurchaseOrderUseCase } from '../../../application/use-cases/submit-purchase-order.usecase';
import { ApprovePurchaseOrderUseCase } from '../../../application/use-cases/approve-purchase-order.usecase';
import { RejectPurchaseOrderUseCase } from '../../../application/use-cases/reject-purchase-order.usecase';
import { CancelPurchaseOrderUseCase } from '../../../application/use-cases/cancel-purchase-order.usecase';

describe('PurchaseOrderBatchOperationAdapter', () => {
  const get = { execute: jest.fn() };
  const submit = { execute: jest.fn() };
  const approve = { execute: jest.fn() };
  const reject = { execute: jest.fn() };
  const cancel = { execute: jest.fn() };
  let adapter: PurchaseOrderBatchOperationAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new PurchaseOrderBatchOperationAdapter(
      get as unknown as GetPurchaseOrderUseCase,
      submit as unknown as SubmitPurchaseOrderUseCase,
      approve as unknown as ApprovePurchaseOrderUseCase,
      reject as unknown as RejectPurchaseOrderUseCase,
      cancel as unknown as CancelPurchaseOrderUseCase,
    );
  });

  it('exposes the supported operations', () => {
    expect(adapter.aggregateType()).toBe('PurchaseOrder');
    expect(adapter.supportedOperations()).toEqual(['submit', 'approve', 'reject', 'cancel']);
  });

  it('rejects an unknown purchase order', async () => {
    get.execute.mockResolvedValue(null);
    await expect(adapter.validate('po-1', 'submit')).resolves.toEqual({
      canProceed: false,
      reason: 'Purchase order not found',
    });
  });

  it('rejects an invalid source status', async () => {
    get.execute.mockResolvedValue({ status: 'APPROVED' });
    await expect(adapter.validate('po-1', 'submit')).resolves.toMatchObject({
      canProceed: false,
    });
  });

  it('allows a valid transition', async () => {
    get.execute.mockResolvedValue({ status: 'DRAFT' });
    await expect(adapter.validate('po-1', 'submit')).resolves.toEqual({ canProceed: true });
  });

  it('executes submit and returns a snapshot', async () => {
    get.execute
      .mockResolvedValueOnce({ status: 'DRAFT' })
      .mockResolvedValueOnce({ status: 'SUBMITTED' });
    await expect(adapter.execute('po-1', 'submit', undefined)).resolves.toEqual({
      resultSnapshot: { transition: 'submit', statusBefore: 'DRAFT', statusAfter: 'SUBMITTED' },
    });
    expect(submit.execute).toHaveBeenCalledWith('po-1');
  });

  it('rejects with the provided reason', async () => {
    get.execute.mockResolvedValue({ status: 'SUBMITTED' });
    await adapter.execute('po-1', 'reject', { reason: 'bad' });
    expect(reject.execute).toHaveBeenCalledWith('po-1', 'bad');
  });

  it('falls back to a default rejection reason', async () => {
    get.execute.mockResolvedValue({ status: 'SUBMITTED' });
    await adapter.execute('po-1', 'reject', undefined);
    expect(reject.execute).toHaveBeenCalledWith('po-1', 'Rejected');
  });
});
