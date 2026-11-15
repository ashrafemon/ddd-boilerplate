import { NotFoundException } from '@nestjs/common';
import { GetVendorUseCase } from '@business/party/vendor/application/use-cases/get-vendor.usecase';
import { VendorQuery } from '@business/party/vendor/application/queries/vendor.query';
import { VendorQueryRecord } from '@business/party/vendor/domain/types/vendor.types';
import { VendorStatus } from '@business/party/vendor/domain/types/vendor.enum';
import { PageQuery, PageResult } from '@common/application/types/pagination';

function makeRecord(overrides?: Partial<VendorQueryRecord>): VendorQueryRecord {
  return {
    id: 'vendor-1',
    code: 'VEN-100',
    name: 'Acme',
    email: 'billing@acme.com',
    phone: null,
    address: null,
    status: VendorStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

class InMemoryVendorQuery extends VendorQuery {
  public readonly byId = new Map<string, VendorQueryRecord>();
  async findById(id: string): Promise<VendorQueryRecord | null> {
    return this.byId.get(id) ?? null;
  }
  async findOrderableById(id: string): Promise<VendorQueryRecord | null> {
    const record = this.byId.get(id);
    return record && record.status === VendorStatus.ACTIVE ? record : null;
  }
  async findOrderableByCodes(codes: string[]): Promise<VendorQueryRecord[]> {
    return codes
      .map(code => [...this.byId.values()].find(r => r.code === code))
      .filter((r): r is VendorQueryRecord => !!r && r.status === VendorStatus.ACTIVE);
  }
  async findAll(query: PageQuery): Promise<PageResult<VendorQueryRecord>> {
    const items = [...this.byId.values()];
    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      total: items.length,
      totalPages: 1,
    };
  }
}

describe('GetVendorUseCase (integration)', () => {
  it('returns the vendor when found', async () => {
    const query = new InMemoryVendorQuery();
    query.byId.set('vendor-1', makeRecord());
    const useCase = new GetVendorUseCase(query);

    const result = await useCase.execute('vendor-1');
    expect(result.id).toBe('vendor-1');
    expect(result.code).toBe('VEN-100');
  });

  it('throws NotFoundException when not found', async () => {
    const query = new InMemoryVendorQuery();
    const useCase = new GetVendorUseCase(query);

    await expect(useCase.execute('missing')).rejects.toThrow(NotFoundException);
  });
});
