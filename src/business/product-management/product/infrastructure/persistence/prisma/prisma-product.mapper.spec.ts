import { PrismaProductMapper } from './prisma-product.mapper';

const createdAt = new Date('2026-01-01T00:00:00Z');
const updatedAt = new Date('2026-01-02T00:00:00Z');
const row = {
  id: 'p-1',
  sku: 'SKU-1',
  name: 'Mouse',
  description: 'Wireless',
  status: 'ACTIVE',
  unitPrice: 9.99,
  currency: 'USD',
  createdAt,
  updatedAt,
  version: 2,
};

describe('PrismaProductMapper', () => {
  it('maps a row to the product aggregate', () => {
    const product = PrismaProductMapper.toDomain(row);
    expect(product.id.toString()).toBe('p-1');
    expect(product.sku).toBe('SKU-1');
    expect(product.unitPrice.toDecimal()).toBe('9.99');
    expect(product.getVersion()).toBe(2);
  });

  it('maps a product aggregate back to a row', () => {
    const product = PrismaProductMapper.toDomain(row);
    expect(PrismaProductMapper.toRow(product)).toMatchObject({
      id: 'p-1',
      sku: 'SKU-1',
      name: 'Mouse',
      status: 'ACTIVE',
      unitPrice: '9.99',
      version: 2,
    });
  });

  it('maps a read row to a query record', () => {
    const record = PrismaProductMapper.toRecord({
      ...row,
      unitPrice: { toString: () => '9.99' },
    } as never);
    expect(record.unitPrice).toBe(9.99);
    expect(record.sku).toBe('SKU-1');
  });
});
