import { PrismaInvoiceMapper } from './prisma-invoice.mapper';

const createdAt = new Date('2026-01-01T00:00:00Z');
const updatedAt = new Date('2026-01-02T00:00:00Z');
const row = {
  id: 'inv-1',
  invoiceNo: 'INV-1',
  customerId: 'c-1',
  status: 'DRAFT',
  currency: 'USD',
  totalAmount: 10,
  lines: [{ description: 'Widget', quantity: 2, unitPrice: 5 }],
  postedAt: null,
  createdAt,
  updatedAt,
  version: 1,
};

describe('PrismaInvoiceMapper', () => {
  it('maps a row to the invoice aggregate', () => {
    const invoice = PrismaInvoiceMapper.toDomain(row);
    expect(invoice.id.toString()).toBe('inv-1');
    expect(invoice.invoiceNo).toBe('INV-1');
    expect(invoice.lines).toHaveLength(1);
    expect(invoice.totalAmount().toDecimal()).toBe('10.00');
  });

  it('maps an invoice aggregate back to a row', () => {
    const invoice = PrismaInvoiceMapper.toDomain(row);
    expect(PrismaInvoiceMapper.toRow(invoice)).toMatchObject({
      id: 'inv-1',
      invoiceNo: 'INV-1',
      customerId: 'c-1',
      status: 'DRAFT',
      totalAmount: 10,
    });
  });

  it('maps a read row with a decimal total to a query record', () => {
    const record = PrismaInvoiceMapper.toRecord({
      ...row,
      totalAmount: { toNumber: () => 10 },
    });
    expect(record.totalAmount).toBe(10);
    expect(record.lines[0]).toEqual({ description: 'Widget', quantity: 2, unitPrice: 5 });
  });
});
