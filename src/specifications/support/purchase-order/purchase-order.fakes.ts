import { PurchaseOrderCommandRepository } from '@business/procurement/purchase-order/domain/repositories/purchase-order-command.repository';
import { PurchaseOrder } from '@business/procurement/purchase-order/domain/aggregates/purchase-order.aggregate';
import { PurchaseOrderLine } from '@business/procurement/purchase-order/domain/entities/purchase-order-line.entity';
import { PurchaseOrderId } from '@business/procurement/purchase-order/domain/value-objects/purchase-order-id.vo';
import { OrderNumber } from '@business/procurement/purchase-order/domain/value-objects/order-number.vo';
import { ProductIdRef } from '@business/procurement/purchase-order/domain/value-objects/product-id-ref.vo';
import { VendorIdRef } from '@business/procurement/purchase-order/domain/value-objects/vendor-id-ref.vo';
import { Money } from '@business/shared-business/domain/common/value-objects/money';
import { PurchaseOrderQuery } from '@business/procurement/purchase-order/application/queries/purchase-order.query';
import { ReadCachePort } from '@business/procurement/purchase-order/application/outbound-ports/read-cache.port';
import { PurchaseOrderPublisherPort } from '@business/procurement/purchase-order/application/publishes/publishers/purchase-order.publisher-port';
import { OrderableVendorPort } from '@business/procurement/purchase-order/application/outbound-ports/vendor-query.port';
import { PurchasableProductPort } from '@business/procurement/purchase-order/application/outbound-ports/product-query.port';
import { NumberingPort } from '@business/procurement/purchase-order/application/outbound-ports/numbering.port';
import { VendorReference } from '@business/party/vendor/public/contracts/vendor-for-purchase.contract';
import { ProductReference } from '@business/product-management/product/public/contracts/product-for-purchase.contract';
import { PurchaseOrderQueryRecord } from '@business/procurement/purchase-order/domain/types/purchase-order.types';
import { OutboxEvent } from '@platform/platform-common/outbox/types/outbox.types';
import { AuditEntry, AuditPort } from '@platform/platform-common/audit/ports/audit.port';
import {
  AbacPort,
  AbacCheck,
  AbacResult,
} from '@platform/platform-organization/authorization/ports/abac.port';
import { InMemoryRequestContextService } from '@test/support/context/in-memory-request-context';
import { PurchaseOrderStatus } from '@business/procurement/purchase-order/domain/types/purchase-order.enum';
import { PageQuery, PageResult } from '@common/application/types/pagination';

export const PO_TEST_CONTEXT = {
  tenantId: 'tenant-1',
  companyId: 'company-1',
  userId: 'user-1',
  roles: ['admin'],
  defaultCurrency: 'USD',
};

export class InMemoryPurchaseOrderRepository extends PurchaseOrderCommandRepository {
  public readonly store = new Map<string, PurchaseOrder>();
  public readonly saves: PurchaseOrder[] = [];
  public readonly updates: PurchaseOrder[] = [];

  async save(po: PurchaseOrder): Promise<PurchaseOrder> {
    this.saves.push(po);
    this.store.set(po.id.toString(), po);
    return po;
  }
  async update(po: PurchaseOrder): Promise<PurchaseOrder> {
    this.updates.push(po);
    this.store.set(po.id.toString(), po);
    return po;
  }
  async findById(id: string): Promise<PurchaseOrder | null> {
    return this.store.get(id) ?? null;
  }
  async findByOrderNumber(): Promise<PurchaseOrder | null> {
    return null;
  }
  async findByExternalReference(): Promise<PurchaseOrder | null> {
    return null;
  }
}

export class InMemoryPurchaseOrderQuery extends PurchaseOrderQuery {
  public readonly receiptsById = new Map<string, boolean>();

  async findById(): Promise<PurchaseOrderQueryRecord | null> {
    return null;
  }
  async findByOrderNumber(): Promise<PurchaseOrderQueryRecord | null> {
    return null;
  }
  async findAll(query: PageQuery): Promise<PageResult<PurchaseOrderQueryRecord>> {
    return { items: [], page: query.page, pageSize: query.pageSize, total: 0, totalPages: 0 };
  }
  async findReceipts(): Promise<null> {
    return null;
  }
  async hasReceipts(id: string): Promise<boolean> {
    return this.receiptsById.get(id) ?? false;
  }
}

export class InMemoryPurchaseOrderPublisherPort extends PurchaseOrderPublisherPort {
  public readonly events: OutboxEvent[] = [];
  async send(event: OutboxEvent, _poId: string): Promise<void> {
    this.events.push(event);
  }
}

export class InMemoryVendorQueryPort extends OrderableVendorPort {
  constructor(private readonly vendors: Map<string, VendorReference> = new Map()) {
    super();
  }
  async getOrderableVendor(id: string): Promise<VendorReference | null> {
    const v = this.vendors.get(id);
    return v && v.status === 'ACTIVE' ? v : null;
  }
  async findOrderableVendorsByCodes(): Promise<VendorReference[]> {
    return [];
  }
}

export class InMemoryProductQueryPort extends PurchasableProductPort {
  constructor(private readonly products: Map<string, ProductReference> = new Map()) {
    super();
  }
  async getPurchasableProduct(id: string): Promise<ProductReference | null> {
    return this.products.get(id) ?? null;
  }
  async findPurchasableProductsBySkus(): Promise<ProductReference[]> {
    return [];
  }
}

export class InMemoryNumberingPort extends NumberingPort {
  private counter = 0;
  async nextNumber(_key: string, options?: { prefix?: string; padding?: number }): Promise<string> {
    this.counter++;
    return `${options?.prefix ?? 'PO-'}${String(this.counter).padStart(options?.padding ?? 8, '0')}`;
  }
}

export class InMemoryPublisherPort extends PurchaseOrderPublisherPort {
  public readonly events: OutboxEvent[] = [];
  async send(event: OutboxEvent, _poId: string): Promise<void> {
    this.events.push(event);
  }
}

export class InMemoryAuditPort extends AuditPort {
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

export function makeContext(overrides?: Record<string, unknown>): InMemoryRequestContextService {
  return new InMemoryRequestContextService({ ...PO_TEST_CONTEXT, ...overrides });
}

export function makeVendorRef(overrides?: Partial<VendorReference>): VendorReference {
  return {
    id: 'vendor-1',
    code: 'VEN-100',
    name: 'Acme',
    email: null,
    phone: null,
    address: null,
    status: 'ACTIVE',
    ...overrides,
  };
}

export function makeProductRef(overrides?: Partial<ProductReference>): ProductReference {
  return {
    id: 'product-1',
    sku: 'SKU-001',
    name: 'Wireless Mouse',
    description: null,
    unitPrice: 1999,
    currency: 'USD',
    status: 'ACTIVE',
    ...overrides,
  };
}

export { PurchaseOrderStatus };

/**
 * Build a purchase order that already has lines, without going through the
 * aggregate's `addLine` (which the current aggregate implements against an
 * unimported event class). Uses `instantiate` with fully-formed props.
 */
export function makePurchaseOrderWithLines(
  lines: { productId: string; quantity: number; unitPriceMinor: number }[],
  overrides?: { status?: PurchaseOrderStatus; orderNumber?: string; vendorId?: string },
): PurchaseOrder {
  const now = new Date();
  const currency = 'USD';

  return PurchaseOrder.instantiate(
    PurchaseOrderId.generate(),
    {
      orderNumber: OrderNumber.create(overrides?.orderNumber ?? 'PO-00000001'),
      vendorId: new VendorIdRef(overrides?.vendorId ?? '11111111-1111-1111-1111-111111111111'),
      status: overrides?.status ?? PurchaseOrderStatus.DRAFT,
      currency,
      lines: lines.map(
        l =>
          new PurchaseOrderLine(
            new ProductIdRef(l.productId),
            l.quantity,
            Money.fromMinorUnits(l.unitPriceMinor, currency),
            Money.fromMinorUnits(l.unitPriceMinor * l.quantity, currency),
          ),
      ),
      createdAt: now,
      updatedAt: now,
    },
    1,
  );
}

export class InMemoryReadCachePort extends ReadCachePort {
  public readonly invalidated: string[] = [];

  async getOrLoad<T>(_key: string, load: () => Promise<T>): Promise<T> {
    return load();
  }
  async invalidate(key: string): Promise<void> {
    this.invalidated.push(key);
  }
}
