import { VendorBillPostedListener } from './vendor-bill-posted.listener';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { VendorBillPostedListenerEvent } from '../contracts/vendor-bill-posted.listener.event';

const envelope = (payload: Record<string, unknown>): VendorBillPostedListenerEvent => ({
  eventId: 'evt-1',
  eventType: 'VendorBillPosted',
  tenantId: 'tenant-1',
  companyId: 'company-1',
  aggregateType: 'VendorBill',
  aggregateId: 'bill-1',
  payload,
  occurredAt: new Date(),
});

describe('VendorBillPostedListener', () => {
  const inbox = { receive: jest.fn(), complete: jest.fn(), fail: jest.fn() };
  const handleBill = { execute: jest.fn() };
  const requestContext = { run: jest.fn() };
  let listener: VendorBillPostedListener;

  beforeEach(() => {
    jest.clearAllMocks();
    requestContext.run.mockImplementation((_ctx: unknown, fn: () => Promise<void>) => fn());
    inbox.receive.mockResolvedValue({ status: 'ACQUIRED', reservation: 'r-1' });
    listener = new VendorBillPostedListener(
      inbox,
      handleBill,
      requestContext as unknown as RequestContextPort,
    );
  });

  it('skips duplicate deliveries', async () => {
    inbox.receive.mockResolvedValue({ status: 'DUPLICATE' });
    await listener.onVendorBillPosted(envelope({}));
    expect(handleBill.execute).not.toHaveBeenCalled();
  });

  it('completes invalid payloads without handling the bill', async () => {
    await listener.onVendorBillPosted(envelope({ vendorId: 'v-1' }));
    expect(handleBill.execute).not.toHaveBeenCalled();
    expect(inbox.complete).toHaveBeenCalledWith({ reservation: 'r-1' });
  });

  it('delegates valid bills to the use case', async () => {
    const payload = {
      vendorId: 'v-1',
      billNumber: 'BILL-1',
      amount: 10,
      currency: 'USD',
      lines: [],
    };
    await listener.onVendorBillPosted(envelope(payload));
    expect(handleBill.execute).toHaveBeenCalledWith(payload);
    expect(inbox.complete).toHaveBeenCalledWith({ reservation: 'r-1' });
  });

  it('fails the inbox reservation and rethrows on handler errors', async () => {
    handleBill.execute.mockRejectedValue(new Error('boom'));
    await expect(
      listener.onVendorBillPosted(envelope({ vendorId: 'v-1', billNumber: 'BILL-1', lines: [] })),
    ).rejects.toThrow('boom');
    expect(inbox.fail).toHaveBeenCalledWith({ reservation: 'r-1', lastError: 'boom' });
  });
});
