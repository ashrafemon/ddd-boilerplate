import { PrismaPriceListMapper } from './prisma-price-list.mapper';

const createdAt = new Date('2026-01-01T00:00:00Z');
const updatedAt = new Date('2026-01-02T00:00:00Z');
const effectiveFrom = new Date('2026-02-01T00:00:00Z');
const row = {
  id: 'pl-1',
  name: 'Retail',
  code: 'PL-1',
  currency: 'USD',
  effectiveFrom,
  effectiveTo: null,
  status: 'DRAFT',
  tenantId: 'tenant-1',
  companyId: 'company-1',
  version: 1,
  createdAt,
  updatedAt,
};

describe('PrismaPriceListMapper', () => {
  it('maps a row to the price list aggregate', () => {
    const priceList = PrismaPriceListMapper.toDomain(row);
    expect(priceList.id.toString()).toBe('pl-1');
    expect(priceList.code).toBe('PL-1');
    expect(priceList.effectiveFrom).toEqual(effectiveFrom);
    expect(priceList.tenantId).toBe('tenant-1');
  });

  it('maps a price list aggregate back to a row', () => {
    const priceList = PrismaPriceListMapper.toDomain(row);
    expect(PrismaPriceListMapper.toRow(priceList)).toMatchObject({
      id: 'pl-1',
      name: 'Retail',
      code: 'PL-1',
      status: 'DRAFT',
      tenantId: 'tenant-1',
      version: 1,
    });
  });

  it('maps a read row to a query record', () => {
    expect(PrismaPriceListMapper.toRecord(row as never)).toMatchObject({
      id: 'pl-1',
      name: 'Retail',
      code: 'PL-1',
      effectiveFrom,
      effectiveTo: null,
    });
  });
});
