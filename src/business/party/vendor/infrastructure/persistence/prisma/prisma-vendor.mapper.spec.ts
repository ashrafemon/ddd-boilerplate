import { PrismaVendorMapper } from './prisma-vendor.mapper';

const createdAt = new Date('2026-01-01T00:00:00Z');
const updatedAt = new Date('2026-01-02T00:00:00Z');
const row = {
  id: 'v-1',
  code: 'VEN-1',
  name: 'Acme',
  email: 'billing@acme.com',
  phone: '123',
  address: 'Main St',
  status: 'ACTIVE',
  createdAt,
  updatedAt,
  version: 3,
};

describe('PrismaVendorMapper', () => {
  it('maps a row to the vendor aggregate', () => {
    const vendor = PrismaVendorMapper.toDomain(row);
    expect(vendor.id.toString()).toBe('v-1');
    expect(vendor.code).toBe('VEN-1');
    expect(vendor.name).toBe('Acme');
    expect(vendor.email).toBe('billing@acme.com');
    expect(vendor.status).toBe('ACTIVE');
    expect(vendor.getVersion()).toBe(3);
  });

  it('maps a vendor aggregate back to a row', () => {
    const vendor = PrismaVendorMapper.toDomain(row);
    expect(PrismaVendorMapper.toRow(vendor)).toMatchObject({
      id: 'v-1',
      code: 'VEN-1',
      name: 'Acme',
      email: 'billing@acme.com',
      status: 'ACTIVE',
      version: 3,
    });
  });

  it('maps a read row to a query record', () => {
    expect(PrismaVendorMapper.toRecord(row as never)).toMatchObject({
      id: 'v-1',
      code: 'VEN-1',
      name: 'Acme',
      status: 'ACTIVE',
      createdAt,
      updatedAt,
    });
  });
});
