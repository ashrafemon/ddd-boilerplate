import { PrismaPurchaseOrderMapper } from './prisma-purchase-order.mapper';

const createdAt = new Date('2026-01-01T00:00:00Z');
const updatedAt = new Date('2026-01-02T00:00:00Z');
const row = {
  id: 'po-1',
  orderNumber: 'PO-1',
  vendorId: 'v-1',
  status: 'DRAFT',
  currency: 'USD',
  lines: [
    {
      productId: 'p-1',
      quantity: 2,
      receivedQuantity: 0,
      unitPrice: 5,
      total: 10,
    },
  ],
  createdAt,
  updatedAt,
  version: 1,
};

describe('PrismaPurchaseOrderMapper', () => {
  it('maps a row to the purchase order aggregate', () => {
    const order = PrismaPurchaseOrderMapper.toDomain(row);
    expect(order.id.toString()).toBe('po-1');
    expect(order.orderNumber).toBe('PO-1');
    expect(order.vendorId).toBe('v-1');
    expect(order.lines).toHaveLength(1);
    expect(order.total.toDecimal()).toBe('10.00');
  });

  it('maps a purchase order aggregate back to a row without writing version', () => {
    const order = PrismaPurchaseOrderMapper.toDomain(row);
    const out = PrismaPurchaseOrderMapper.toRow(order);
    expect(out).toMatchObject({
      id: 'po-1',
      orderNumber: 'PO-1',
      vendorId: 'v-1',
      status: 'DRAFT',
      subtotal: '10.00',
      total: '10.00',
    });
    expect(out).not.toHaveProperty('version');
  });

  it('builds line create input with decimal strings', () => {
    const order = PrismaPurchaseOrderMapper.toDomain(row);
    expect(PrismaPurchaseOrderMapper.toLinesCreateInput(order)).toEqual([
      {
        productId: 'p-1',
        quantity: 2,
        receivedQuantity: 0,
        descriptionSnapshot: null,
        unitPrice: '5.00',
        total: '10.00',
      },
    ]);
  });

  it('maps a read row to a query record', () => {
    const readRow = {
      ...row,
      subtotal: { toString: () => '10' },
      total: { toString: () => '10' },
      lines: [
        {
          productId: 'p-1',
          quantity: 2,
          receivedQuantity: 0,
          unitPrice: { toString: () => '5' },
          total: { toString: () => '10' },
        },
      ],
    };
    const record = PrismaPurchaseOrderMapper.toRecord(readRow as never);
    expect(record.subtotal).toBe(10);
    expect(record.total).toBe(10);
    expect(record.lines[0].unitPrice).toBe(5);
    expect(record.createdAt).toBe(createdAt.toISOString());
  });
});
