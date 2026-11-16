import { PurchaseOrderNotificationAdapter } from './purchase-order-notification.adapter';
import { GetPurchaseOrderUseCase } from '../../../application/use-cases/get-purchase-order.usecase';
import { OrderableVendorPort } from '../../../application/outbound-ports/vendor-query.port';

describe('PurchaseOrderNotificationAdapter', () => {
  const getPurchaseOrder = { execute: jest.fn() };
  const vendorQuery = { getOrderableVendor: jest.fn() };
  let adapter: PurchaseOrderNotificationAdapter;

  const payload = { purchaseOrderId: { value: 'po-1' } };

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new PurchaseOrderNotificationAdapter(
      getPurchaseOrder as unknown as GetPurchaseOrderUseCase,
      vendorQuery as unknown as OrderableVendorPort,
    );
  });

  it('resolves the vendor recipient', async () => {
    getPurchaseOrder.execute.mockResolvedValue({ vendorId: 'v-1' });
    vendorQuery.getOrderableVendor.mockResolvedValue({
      id: 'v-1',
      email: 'vendor@acme.com',
      name: 'Acme',
    });
    await expect(adapter.resolveRecipients(payload)).resolves.toEqual([
      { recipientRef: 'v-1', address: 'vendor@acme.com' },
    ]);
  });

  it('returns no recipients without a vendor email', async () => {
    getPurchaseOrder.execute.mockResolvedValue({ vendorId: 'v-1' });
    vendorQuery.getOrderableVendor.mockResolvedValue({ id: 'v-1' });
    await expect(adapter.resolveRecipients(payload)).resolves.toEqual([]);
  });

  it('returns no recipients without a purchase order id', async () => {
    await expect(adapter.resolveRecipients({})).resolves.toEqual([]);
    expect(getPurchaseOrder.execute).not.toHaveBeenCalled();
  });

  it('builds the template model', async () => {
    getPurchaseOrder.execute.mockResolvedValue({
      vendorId: 'v-1',
      orderNumber: 'PO-1',
      currency: 'USD',
      subtotal: 10,
      total: 10,
    });
    vendorQuery.getOrderableVendor.mockResolvedValue({ id: 'v-1', name: 'Acme' });
    await expect(adapter.resolveModel(payload)).resolves.toEqual({
      orderNumber: 'PO-1',
      currency: 'USD',
      subtotal: 10,
      total: 10,
      vendorName: 'Acme',
    });
  });

  it('returns an empty model without a purchase order id', async () => {
    await expect(adapter.resolveModel({})).resolves.toEqual({});
  });
});
