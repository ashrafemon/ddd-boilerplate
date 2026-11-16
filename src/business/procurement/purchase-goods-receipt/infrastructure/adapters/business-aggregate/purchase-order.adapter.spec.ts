import { PurchaseOrderAdapter } from './purchase-order.adapter';

describe('Grn PurchaseOrderAdapter', () => {
  const port = {
    getPurchaseOrder: jest.fn(),
    registerReceipt: jest.fn(),
    hasReceipts: jest.fn(),
  };
  let adapter: PurchaseOrderAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new PurchaseOrderAdapter(port);
  });

  it('delegates getPurchaseOrder', async () => {
    port.getPurchaseOrder.mockResolvedValue({ id: 'po-1' });
    await expect(adapter.getPurchaseOrder('po-1')).resolves.toEqual({ id: 'po-1' });
    expect(port.getPurchaseOrder).toHaveBeenCalledWith('po-1');
  });

  it('delegates registerReceipt', async () => {
    port.registerReceipt.mockResolvedValue({ receiptStatus: 'PARTIALLY_RECEIVED' });
    const request = { purchaseOrderId: 'po-1', lines: [] };
    await expect(adapter.registerReceipt(request)).resolves.toEqual({
      receiptStatus: 'PARTIALLY_RECEIVED',
    });
    expect(port.registerReceipt).toHaveBeenCalledWith(request);
  });

  it('delegates hasReceipts', async () => {
    port.hasReceipts.mockResolvedValue(true);
    await expect(adapter.hasReceipts('po-1')).resolves.toBe(true);
  });
});
