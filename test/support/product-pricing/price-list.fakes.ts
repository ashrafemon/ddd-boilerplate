import { PriceListCommandRepository } from '@business/product-management/product-pricing/domain/repositories/price-list-command.repository';
import { PriceList } from '@business/product-management/product-pricing/domain/aggregates/price-list.aggregate';
import { PriceListQuery } from '@business/product-management/product-pricing/application/queries/price-list.query';
import { PriceListPublisherPort } from '@business/product-management/product-pricing/application/publishes/publishers/price-list.publisher-port';
import {
  GetProductPriceResult,
  PriceListQueryRecord,
} from '@business/product-management/product-pricing/domain/types/price-list.types';
import { OutboxEvent } from '@platform/platform-common/outbox/outbox.types';
import {
  AbacPort,
  AbacCheck,
  AbacResult,
} from '@platform/platform-organization/authorization/ports/abac.port';
import { InMemoryRequestContextService } from '@test/support/context/in-memory-request-context';
import { PageQuery, PageResult } from '@common/application/types/pagination';

export const PRICE_LIST_TEST_CONTEXT = {
  tenantId: 'tenant-1',
  companyId: 'company-1',
  userId: 'user-1',
  roles: ['admin'],
  defaultCurrency: 'USD',
};

export class InMemoryPriceListRepository extends PriceListCommandRepository {
  public readonly store = new Map<string, PriceList>();
  public readonly saved: PriceList[] = [];
  public readonly updates: PriceList[] = [];

  async findById(id: string): Promise<PriceList | null> {
    return this.store.get(id) ?? null;
  }
  async findByCode(code: string): Promise<PriceList | null> {
    return [...this.store.values()].find(l => l.code === code) ?? null;
  }
  async save(priceList: PriceList): Promise<PriceList> {
    this.saved.push(priceList);
    this.store.set(priceList.id.toString(), priceList);
    return priceList;
  }
  async update(priceList: PriceList): Promise<PriceList> {
    this.updates.push(priceList);
    this.store.set(priceList.id.toString(), priceList);
    return priceList;
  }
}

export class InMemoryPriceListQuery extends PriceListQuery {
  public readonly byId = new Map<string, PriceListQueryRecord>();
  public priceForProduct: GetProductPriceResult | null = null;

  async findById(id: string): Promise<PriceListQueryRecord | null> {
    return this.byId.get(id) ?? null;
  }
  async findByCode(code: string): Promise<PriceListQueryRecord | null> {
    return [...this.byId.values()].find(r => r.code === code) ?? null;
  }
  async findActiveByCode(code: string): Promise<PriceListQueryRecord | null> {
    const record = [...this.byId.values()].find(r => r.code === code);
    return record && record.status === 'ACTIVE' ? record : null;
  }
  async findPurchasablePriceForProduct(): Promise<GetProductPriceResult | null> {
    return this.priceForProduct;
  }
  async findAll(query: PageQuery): Promise<PageResult<PriceListQueryRecord>> {
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

export class InMemoryPriceListPublisherPort extends PriceListPublisherPort {
  public readonly events: OutboxEvent[] = [];
  async send(event: OutboxEvent, _priceListId: string): Promise<void> {
    this.events.push(event);
  }
}

export class AllowAbacAdapter extends AbacPort {
  async evaluate(_check: AbacCheck): Promise<AbacResult> {
    return { decision: 'ALLOW' };
  }
}
export class DenyAbacAdapter extends AbacPort {
  async evaluate(_check: AbacCheck): Promise<AbacResult> {
    return { decision: 'DENY', reason: 'Denied' };
  }
}

export function makePriceListContext(
  overrides?: Record<string, unknown>,
): InMemoryRequestContextService {
  return new InMemoryRequestContextService({ ...PRICE_LIST_TEST_CONTEXT, ...overrides });
}
