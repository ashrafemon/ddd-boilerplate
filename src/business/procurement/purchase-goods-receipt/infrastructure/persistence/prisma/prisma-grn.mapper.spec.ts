import { PrismaGrnMapper } from './prisma-grn.mapper';

const createdAt = new Date('2026-01-01T00:00:00Z');
const updatedAt = new Date('2026-01-02T00:00:00Z');
const row = {
  id: 'grn-1',
  grnNumber: 'GRN-1',
  purchaseOrderId: 'po-1',
  vendorId: 'v-1',
  status: 'DRAFT',
  currency: 'USD',
  subtotal: 10,
  total: 10,
  lines: [
    {
      productId: 'p-1',
      orderedQuantity: 5,
      receivedQuantity: 2,
      acceptedQuantity: 2,
      rejectedQuantity: 0,
      unitPrice: 5,
      total: 10,
    },
  ],
  receivedAt: null,
  reversalOfId: null,
  createdBy: null,
  receivedBy: null,
  postedBy: null,
  cancelledBy: null,
  createdAt,
  updatedAt,
  version: 1,
};

describe('PrismaGrnMapper', () => {
  it('maps a row to the GRN aggregate', () => {
    const grn = PrismaGrnMapper.toDomain(row);
    expect(grn.id.toString()).toBe('grn-1');
    expect(grn.grnNumber).toBe('GRN-1');
    expect(grn.lines).toHaveLength(1);
    expect(grn.lines[0].productId).toBe('p-1');
    expect(grn.total).toBe(10);
  });

  it('maps a GRN aggregate back to a row without writing version', () => {
    const grn = PrismaGrnMapper.toDomain(row);
    const out = PrismaGrnMapper.toRow(grn);
    expect(out).toMatchObject({
      id: 'grn-1',
      grnNumber: 'GRN-1',
      status: 'DRAFT',
      subtotal: 10,
      total: 10,
    });
    expect(out).not.toHaveProperty('version');
  });

  it('builds line create input', () => {
    const grn = PrismaGrnMapper.toDomain(row);
    expect(PrismaGrnMapper.toLinesCreateInput(grn)).toEqual([
      {
        productId: 'p-1',
        orderedQuantity: 5,
        receivedQuantity: 2,
        acceptedQuantity: 2,
        rejectedQuantity: 0,
        unitPrice: 5,
        total: 10,
      },
    ]);
  });

  it('maps a read row to a query record with ISO dates', () => {
    const record = PrismaGrnMapper.toRecord(row as never);
    expect(record.createdAt).toBe(createdAt.toISOString());
    expect(record.receivedAt).toBeNull();
    expect(record.lines).toHaveLength(1);
  });
});
