import { GrnReference } from '../../public/contracts/grn-for-purchase-order.contract';

describe('GrnReference contract', () => {
  const reference: GrnReference = {
    id: 'grn-1',
    grnNumber: 'GRN-1',
    purchaseOrderId: 'po-1',
    vendorId: 'v-1',
    status: 'RECEIVED',
    currency: 'USD',
    subtotal: 10,
    total: 10,
    lines: [
      {
        productId: 'p-1',
        orderedQuantity: 2,
        receivedQuantity: 1,
        unitPrice: 5,
        total: 5,
      },
    ],
    receivedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('exposes the receipt lines and totals consumers need', () => {
    expect(reference).toMatchObject({
      id: 'grn-1',
      grnNumber: 'GRN-1',
      purchaseOrderId: 'po-1',
      subtotal: 10,
      total: 10,
    });
    expect(reference.lines[0]).toMatchObject({
      productId: 'p-1',
      orderedQuantity: 2,
      receivedQuantity: 1,
      unitPrice: 5,
      total: 5,
    });
  });
});
