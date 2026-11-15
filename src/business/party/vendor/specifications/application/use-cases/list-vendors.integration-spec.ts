import { ListVendorsUseCase } from '@business/party/vendor/application/use-cases/list-vendors.usecase';
import { VendorQuery } from '@business/party/vendor/application/queries/vendor.query';
import { VendorQueryRecord } from '@business/party/vendor/domain/types/vendor.types';
import { VendorStatus } from '@business/party/vendor/domain/types/vendor.enum';
import { PageQuery, PageResult } from '@common/application/types/pagination';

function makeRecord(id: string): VendorQueryRecord {
  return {
    id,
    code: `VEN-${id}`,
    name: `Vendor ${id}`,
    email: null,
    phone: null,
    address: null,
    status: VendorStatus.ACTIVE,
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
  async findOrderableByCodes(): Promise<VendorQueryRecord[]> {
    return [];
  }
  async findAll(query: PageQuery): Promise<PageResult<VendorQueryRecord>> {
    const start = (query.page - 1) * query.pageSize;
    return {
      items: this.records.slice(start, start + query.pageSize),
      page: query.page,
      pageSize: query.pageSize,
      total: this.records.length,
      totalPages: Math.ceil(this.records.length / query.pageSize),
    };
  }
}

describe('ListVendorsUseCase (integration)', () => {
  it('paginates vendors', async () => {
    const records = [makeRecord('1'), makeRecord('2'), makeRecord('3')];
    const useCase = new ListVendorsUseCase(new InMemoryVendorQuery(records));

    const result = await useCase.execute({ page: 1, pageSize: 2 });
    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(3);
    expect(result.totalPages).toBe(2);
  });

  it('returns an empty page when there are no vendors', async () => {
    const useCase = new ListVendorsUseCase(new InMemoryVendorQuery([]));
    const result = await useCase.execute({ page: 1, pageSize: 20 });
    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});
