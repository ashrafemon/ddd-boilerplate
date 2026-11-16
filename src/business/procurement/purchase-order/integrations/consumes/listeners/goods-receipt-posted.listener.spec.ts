import { GoodsReceiptPostedListener } from './goods-receipt-posted.listener';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { RegisterPurchaseOrderReceiptUseCase } from '../../../application/use-cases/register-purchase-order-receipt.usecase';
import { GoodsReceiptPostedListenerEvent } from '../contracts/goods-receipt-posted.listener.event';

const envelope = (payload: Record<string, unknown>): GoodsReceiptPostedListenerEvent => ({
  eventId: 'evt-1',
  eventType: 'GoodsReceiptPosted',
  tenantId: 'tenant-1',
  companyId: 'company-1',
  aggregateType: 'GoodReceiptNote',
  aggregateId: 'grn-1',
  payload,
  occurredAt: new Date(),
});

describe('GoodsReceiptPostedListener', () => {
  const inbox = {
    receive: jest.fn(),
    complete: jest.fn(),
    fail: jest.fn(),
  };
  const registerReceipt = { execute: jest.fn() };
  const requestContext = { run: jest.fn() };
  let listener: GoodsReceiptPostedListener;

  beforeEach(() => {
    jest.clearAllMocks();
    requestContext.run.mockImplementation((_ctx: unknown, fn: () => Promise<void>) => fn());
    inbox.receive.mockResolvedValue({ status: 'ACQUIRED', reservation: 'r-1' });
    listener = new GoodsReceiptPostedListener(
      inbox,
      registerReceipt as unknown as RegisterPurchaseOrderReceiptUseCase,
      requestContext as unknown as RequestContextPort,
    );
  });

  it('skips duplicate deliveries', async () => {
    inbox.receive.mockResolvedValue({ status: 'DUPLICATE' });
    await listener.onGoodsReceiptPosted(envelope({ purchaseOrderId: 'po-1', lines: [] }));
    expect(registerReceipt.execute).not.toHaveBeenCalled();
    expect(inbox.complete).not.toHaveBeenCalled();
  });

  it('completes invalid payloads without registering a receipt', async () => {
    await listener.onGoodsReceiptPosted(envelope({ grnId: 'grn-1' }));
    expect(registerReceipt.execute).not.toHaveBeenCalled();
    expect(inbox.complete).toHaveBeenCalledWith({ reservation: 'r-1' });
  });

  it('registers accepted quantities from the event', async () => {
    await listener.onGoodsReceiptPosted(
      envelope({
        purchaseOrderId: 'po-1',
        lines: [{ productId: 'p-1', acceptedQuantity: 3 }],
      }),
    );
    expect(registerReceipt.execute).toHaveBeenCalledWith({
      purchaseOrderId: 'po-1',
      lines: [{ productId: 'p-1', receivedQuantity: 3 }],
      actorId: 'system',
    });
    expect(inbox.complete).toHaveBeenCalledWith({ reservation: 'r-1' });
    expect(inbox.fail).not.toHaveBeenCalled();
  });

  it('fails the inbox reservation and rethrows on handler errors', async () => {
    registerReceipt.execute.mockRejectedValue(new Error('boom'));
    await expect(
      listener.onGoodsReceiptPosted(
        envelope({
          purchaseOrderId: 'po-1',
          lines: [{ productId: 'p-1', acceptedQuantity: 1 }],
        }),
      ),
    ).rejects.toThrow('boom');
    expect(inbox.fail).toHaveBeenCalledWith({ reservation: 'r-1', lastError: 'boom' });
  });
});
