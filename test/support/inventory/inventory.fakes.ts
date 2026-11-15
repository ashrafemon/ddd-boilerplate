import {
  StockMovement,
  StockBalance,
} from '@business/inventory/domain/aggregates/stock-movement.aggregate';
import {
  StockBalanceRepository,
  StockMovementCommandRepository,
} from '@business/inventory/domain/repositories/stock-movement-command.repository';
import { StockMovementQuery } from '@business/inventory/application/queries/stock-movement.query';
import { InventoryPublisherPort } from '@business/inventory/application/publishes/publishers/inventory.publisher-port';
import { StockMovementQueryRecord } from '@business/inventory/domain/types/stock-movement.types';
import { OutboxEvent } from '@platform/platform-common/outbox/outbox.types';
import { AuditEntry, AuditPort } from '@platform/platform-common/audit/ports/audit.port';
import {
  AbacPort,
  AbacCheck,
  AbacResult,
} from '@platform/platform-organization/authorization/ports/abac.port';
import { InMemoryRequestContextService } from '@test/support/context/in-memory-request-context';
import { PageQuery, PageResult } from '@common/application/types/pagination';

export const INVENTORY_TEST_CONTEXT = {
  tenantId: 'tenant-1',
  companyId: 'company-1',
  userId: 'user-1',
  roles: ['admin'],
  defaultCurrency: 'USD',
};

export class InMemoryStockMovementRepository extends StockMovementCommandRepository {
  public readonly store = new Map<string, StockMovement>();
  public readonly saved: StockMovement[] = [];

  async findById(id: string): Promise<StockMovement | null> {
    return this.store.get(id) ?? null;
  }
  async findByGrnLineId(grnLineId: string): Promise<StockMovement | null> {
    return [...this.store.values()].find(m => m.grnLineId === grnLineId) ?? null;
  }
  async save(movement: StockMovement): Promise<StockMovement> {
    this.saved.push(movement);
    this.store.set(movement.id.toString(), movement);
    return movement;
  }
}

export class InMemoryStockBalanceRepository extends StockBalanceRepository {
  public readonly byProduct = new Map<string, StockBalance>();
  public readonly saved: StockBalance[] = [];

  async findByProduct(productId: string): Promise<StockBalance | null> {
    return this.byProduct.get(productId) ?? null;
  }
  async save(balance: StockBalance): Promise<StockBalance> {
    this.saved.push(balance);
    this.byProduct.set(balance.productId, balance);
    return balance;
  }
}

export class InMemoryStockMovementQuery extends StockMovementQuery {
  public readonly byId = new Map<string, StockMovementQueryRecord>();
  public balance: { productId: string; quantity: number } | null = null;

  async findById(id: string): Promise<StockMovementQueryRecord | null> {
    return this.byId.get(id) ?? null;
  }
  async findByProduct(
    _productId: string,
    _companyId?: string,
    _tenantId?: string,
    query?: PageQuery,
  ): Promise<PageResult<StockMovementQueryRecord>> {
    const items = [...this.byId.values()];
    const page = query?.page ?? 1;
    const pageSize = query?.pageSize ?? items.length;
    const start = (page - 1) * pageSize;
    return {
      items: items.slice(start, start + pageSize),
      page,
      pageSize,
      total: items.length,
      totalPages: Math.ceil(items.length / pageSize),
    };
  }
  async findBalance(): Promise<{ productId: string; quantity: number } | null> {
    return this.balance;
  }
}

export class InMemoryInventoryPublisherPort extends InventoryPublisherPort {
  public readonly events: OutboxEvent[] = [];
  async send(event: OutboxEvent, _movementId: string): Promise<void> {
    this.events.push(event);
  }
}

export class InMemoryInventoryAuditPort extends AuditPort {
  public readonly entries: AuditEntry[] = [];
  async record(entry: AuditEntry): Promise<void> {
    this.entries.push(entry);
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

export function makeInventoryContext(
  overrides?: Record<string, unknown>,
): InMemoryRequestContextService {
  return new InMemoryRequestContextService({ ...INVENTORY_TEST_CONTEXT, ...overrides });
}

export function makeStockMovementQueryRecord(
  overrides?: Partial<StockMovementQueryRecord>,
): StockMovementQueryRecord {
  return {
    id: 'sm-1',
    grnLineId: 'grn-line-1',
    productId: 'p1',
    quantity: 5,
    movementType: 'GOODS_RECEIPT',
    sourceDocumentId: 'grn-1',
    sourceDocumentType: 'GRN',
    companyId: 'company-1',
    tenantId: 'tenant-1',
    effectiveDate: new Date(),
    createdAt: new Date(),
    ...overrides,
  } as StockMovementQueryRecord;
}
