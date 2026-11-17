import { VendorForPurchaseFacade } from '@business/party/vendor/application/facades/vendor-for-purchase.facade';
import { GetOrderableVendorUseCase } from '@business/party/vendor/application/use-cases/get-orderable-vendor.usecase';
import { FindOrderableVendorsByCodesUseCase } from '@business/party/vendor/application/use-cases/find-orderable-vendors-by-codes.usecase';
import { VendorQuery } from '@business/party/vendor/application/queries/vendor.query';
import { VendorQueryRecord } from '@business/party/vendor/domain/types/vendor.types';
import { VendorStatus } from '@business/party/vendor/domain/types/vendor.enum';
import { PageQuery, PageResult } from '@common/application/types/pagination';

function makeRecord(code: string, status: VendorStatus): VendorQueryRecord {
  return {
    id: `id-${code}`,
    code,
    name: `Vendor ${code}`,
    email: null,
    phone: null,
    address: null,
    status,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

class InMemoryVendorQuery extends VendorQuery {
  constructor(private readonly records: VendorQueryRecord[]) {
    super();
  }
  async findById(id: string): Promise<VendorQueryRecord | null> {
    return this.records.find(r => r.id === id) ?? null;
  }
  async findOrderableById(id: string): Promise<VendorQueryRecord | null> {
    const r = this.records.find(r => r.id === id);
    return r && r.status === VendorStatus.ACTIVE ? r : null;
  }
  async findOrderableByCodes(codes: string[]): Promise<VendorQueryRecord[]> {
    return this.records.filter(r => codes.includes(r.code) && r.status === VendorStatus.ACTIVE);
  }
  async findAll(query: PageQuery): Promise<PageResult<VendorQueryRecord>> {
    return { items: [], page: query.page, pageSize: query.pageSize, total: 0, totalPages: 0 };
  }
}

describe('VendorForPurchaseFacade (integration)', () => {
  const records = [
    makeRecord('VEN-1', VendorStatus.ACTIVE),
    makeRecord('VEN-2', VendorStatus.BLOCKED),
  ];
  const query = new InMemoryVendorQuery(records);
  const facade = new VendorForPurchaseFacade(
    new GetOrderableVendorUseCase(query),
    new FindOrderableVendorsByCodesUseCase(query),
  );

  it('delegates getOrderableVendor to the use case', async () => {
    await expect(facade.getOrderableVendor('id-VEN-1')).resolves.toMatchObject({ code: 'VEN-1' });
    await expect(facade.getOrderableVendor('missing')).resolves.toBeNull();
  });

  it('delegates findOrderableVendorsByCodes and filters non-active', async () => {
    const result = await facade.findOrderableVendorsByCodes(['VEN-1', 'VEN-2']);
    expect(result.map(r => r.code)).toEqual(['VEN-1']);
  });
});
