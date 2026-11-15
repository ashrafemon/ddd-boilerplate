import { GetOrderableVendorUseCase } from '@business/party/vendor/application/use-cases/get-orderable-vendor.usecase';
import { VendorQuery } from '@business/party/vendor/application/queries/vendor.query';
import { VendorQueryRecord } from '@business/party/vendor/domain/types/vendor.types';
import { VendorStatus } from '@business/party/vendor/domain/types/vendor.enum';
import { PageQuery, PageResult } from '@common/application/types/pagination';

function makeRecord(status: VendorStatus): VendorQueryRecord {
  return {
    id: 'vendor-1',
    code: 'VEN-100',
    name: 'Acme',
    email: null,
    phone: null,
    address: null,
    status,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

class InMemoryVendorQuery extends VendorQuery {
  constructor(private readonly record: VendorQueryRecord | null) {
    super();
  }
  async findById(): Promise<VendorQueryRecord | null> {
    return this.record;
  }
  async findOrderableById(): Promise<VendorQueryRecord | null> {
    return this.record && this.record.status === VendorStatus.ACTIVE ? this.record : null;
  }
  async findOrderableByCodes(): Promise<VendorQueryRecord[]> {
    return [];
  }
  async findAll(query: PageQuery): Promise<PageResult<VendorQueryRecord>> {
    return { items: [], page: query.page, pageSize: query.pageSize, total: 0, totalPages: 0 };
  }
}

describe('GetOrderableVendorUseCase (integration)', () => {
  it('returns an ACTIVE vendor', async () => {
    const useCase = new GetOrderableVendorUseCase(
      new InMemoryVendorQuery(makeRecord(VendorStatus.ACTIVE)),
    );
    const result = await useCase.execute('vendor-1');
    expect(result?.code).toBe('VEN-100');
  });

  it('returns null for a non-active vendor', async () => {
    const useCase = new GetOrderableVendorUseCase(
      new InMemoryVendorQuery(makeRecord(VendorStatus.BLOCKED)),
    );
    await expect(useCase.execute('vendor-1')).resolves.toBeNull();
  });

  it('returns null when the vendor is missing', async () => {
    const useCase = new GetOrderableVendorUseCase(new InMemoryVendorQuery(null));
    await expect(useCase.execute('vendor-1')).resolves.toBeNull();
  });
});
