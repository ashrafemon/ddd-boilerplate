import { PurchaseOrderFactory } from './purchase-order.factory';
import { PurchaseOrderStatus } from '../types/purchase-order.enum';

describe('PurchaseOrderFactory', () => {
  it('creates draft purchase order with defaults', () => {
    const po = PurchaseOrderFactory.create({
      orderNumber: 'PO-00000001',
      vendorId: '11111111-1111-1111-1111-111111111111',
    });

    expect(po.status).toBe(PurchaseOrderStatus.DRAFT);
    expect(po.currency).toBe('USD');
    expect(po.lines).toHaveLength(0);
    expect(po.id.toString()).toBeTruthy();
  });

  it('rejects creation without vendor', () => {
    expect(() =>
      PurchaseOrderFactory.create({
        orderNumber: 'PO-00000002',
        vendorId: '',
      }),
    ).toThrow('Purchase order vendor is required');
  });
});
