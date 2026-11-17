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
  async findById(): Promise<VendorQueryRecord | null> {
    return null;
  }
  async findOrderableById(): Promise<VendorQueryRecord | null> {
    return null;
  }
  async findOrderableByCodes(codes: string[]): Promise<VendorQueryRecord[]> {
    return this.records.filter(r => codes.includes(r.code) && r.status === VendorStatus.ACTIVE);
  }
  async findAll(query: PageQuery): Promise<PageResult<VendorQueryRecord>> {
    return { items: [], page: query.page, pageSize: query.pageSize, total: 0, totalPages: 0 };
  }
}

describe('FindOrderableVendorsByCodesUseCase (integration)', () => {
  it('returns only ACTIVE vendors matching the codes', async () => {
    const records = [
      makeRecord('VEN-1', VendorStatus.ACTIVE),
      makeRecord('VEN-2', VendorStatus.INACTIVE),
      makeRecord('VEN-3', VendorStatus.ACTIVE),
    ];
    const useCase = new FindOrderableVendorsByCodesUseCase(new InMemoryVendorQuery(records));

    const result = await useCase.execute(['VEN-1', 'VEN-2', 'VEN-3']);
    expect(result.map(r => r.code)).toEqual(['VEN-1', 'VEN-3']);
  });

  it('returns an empty list when no codes match', async () => {
    const useCase = new FindOrderableVendorsByCodesUseCase(new InMemoryVendorQuery([]));
    await expect(useCase.execute(['NOPE'])).resolves.toEqual([]);
  });
});
