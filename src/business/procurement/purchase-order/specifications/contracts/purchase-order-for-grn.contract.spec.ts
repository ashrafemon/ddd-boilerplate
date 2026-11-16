import { PurchaseOrderReference } from '../../public/contracts/purchase-order-for-grn.contract';

describe('PurchaseOrderReference contract', () => {
  const reference: PurchaseOrderReference = {
    id: 'po-1',
    orderNumber: 'PO-1',
    vendorId: 'v-1',
    status: 'DRAFT',
    currency: 'USD',
    subtotal: 10,
    total: 10,
    lines: [{ productId: 'p-1', quantity: 2, unitPrice: 5, total: 10 }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('exposes the ordered lines consumers read', () => {
    expect(reference).toMatchObject({
      id: 'po-1',
      orderNumber: 'PO-1',
      vendorId: 'v-1',
      currency: 'USD',
    });
    expect(reference.lines[0]).toMatchObject({
      productId: 'p-1',
      quantity: 2,
      unitPrice: 5,
      total: 10,
    });
  });
});
