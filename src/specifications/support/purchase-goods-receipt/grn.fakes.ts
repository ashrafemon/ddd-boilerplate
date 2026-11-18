import { GrnCommandRepository } from '@business/procurement/purchase-goods-receipt/domain/repositories/grn-command.repository';
import { GoodReceiptNote } from '@business/procurement/purchase-goods-receipt/domain/aggregates/grn.aggregate';
import { GrnQuery } from '@business/procurement/purchase-goods-receipt/application/queries/grn.query';
import { GrnPublisherPort } from '@business/procurement/purchase-goods-receipt/application/publishes/publishers/grn.publisher-port';
import { PurchaseOrderPort } from '@business/procurement/purchase-goods-receipt/application/outbound-ports/purchase-order-query.port';
import { NumberingPort } from '@business/procurement/purchase-goods-receipt/application/outbound-ports/numbering.port';
import { PurchaseOrderReference } from '@business/procurement/purchase-order/public/contracts/purchase-order-for-grn.contract';
import {
  PurchaseOrderReceiptRequest,
  PurchaseOrderReceiptResult,
} from '@business/procurement/purchase-order/public/contracts/purchase-order-receipt.contract';
import { GrnQueryRecord } from '@business/procurement/purchase-goods-receipt/domain/types/grn.types';
import { GrnStatus } from '@business/procurement/purchase-goods-receipt/domain/types/grn.enum';
import { OutboxEvent } from '@platform/platform-common/outbox/types/outbox.types';
import { AuditEntry, AuditPort } from '@platform/platform-common/audit/inbound/ports/audit.port';
import {
  AbacPort,
  AbacCheck,
  AbacResult,
} from '@platform/platform-organization/authorization/ports/abac.port';
import { InMemoryRequestContextService } from '@test/support/context/in-memory-request-context';
import { PageQuery, PageResult } from '@common/application/types/pagination';

export const GRN_TEST_CONTEXT = {
  tenantId: 'tenant-1',
  companyId: 'company-1',
  userId: 'user-1',
  roles: ['admin'],
  defaultCurrency: 'USD',
};

export class InMemoryGrnRepository extends GrnCommandRepository {
  public readonly store = new Map<string, GoodReceiptNote>();
  public readonly saved: GoodReceiptNote[] = [];
  public readonly updates: GoodReceiptNote[] = [];
  public readonly reversalOfIndex = new Map<string, GoodReceiptNote>();

  async save(grn: GoodReceiptNote): Promise<GoodReceiptNote> {
    this.saved.push(grn);
    this.store.set(grn.id.toString(), grn);
    return grn;
  }
  async update(grn: GoodReceiptNote): Promise<GoodReceiptNote> {
    this.updates.push(grn);
    this.store.set(grn.id.toString(), grn);
    return grn;
  }
  async findById(id: string): Promise<GoodReceiptNote | null> {
    return this.store.get(id) ?? null;
  }
  async findByGrnNumber(): Promise<GoodReceiptNote | null> {
    return null;
  }
  async findByReversalOfId(reversalOfId: string): Promise<GoodReceiptNote | null> {
    return this.reversalOfIndex.get(reversalOfId) ?? null;
  }
}

export class InMemoryGrnQuery extends GrnQuery {
  public readonly byId = new Map<string, GrnQueryRecord>();

  async findById(id: string): Promise<GrnQueryRecord | null> {
    return this.byId.get(id) ?? null;
  }
  async findByGrnNumber(): Promise<GrnQueryRecord | null> {
    return null;
  }
  async findAll(query: PageQuery): Promise<PageResult<GrnQueryRecord>> {
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

export class InMemoryGrnPublisherPort extends GrnPublisherPort {
  public readonly events: OutboxEvent[] = [];
  async send(event: OutboxEvent, _grnId: string): Promise<void> {
    this.events.push(event);
  }
}

export class InMemoryPurchaseOrderPort extends PurchaseOrderPort {
  public readonly receiptsRegistered: PurchaseOrderReceiptRequest[] = [];
  public hasReceiptsResult = false;

  async getPurchaseOrder(_id: string): Promise<PurchaseOrderReference | null> {
    return null;
  }
  async registerReceipt(request: PurchaseOrderReceiptRequest): Promise<PurchaseOrderReceiptResult> {
    this.receiptsRegistered.push(request);
    return {
      purchaseOrderId: request.purchaseOrderId,
      receiptStatus: 'NOT_RECEIVED',
      lines: [],
    };
  }
  async hasReceipts(_purchaseOrderId: string): Promise<boolean> {
    return this.hasReceiptsResult;
  }
}

export class InMemoryGrnNumberingPort extends NumberingPort {
  private counter = 0;
  async nextNumber(_key: string, options?: { prefix?: string; padding?: number }): Promise<string> {
    this.counter++;
    return `${options?.prefix ?? 'GRN-'}${String(this.counter).padStart(options?.padding ?? 8, '0')}`;
  }
}

export class InMemoryGrnAuditPort extends AuditPort {
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

export function makeGrnContext(overrides?: Record<string, unknown>): InMemoryRequestContextService {
  return new InMemoryRequestContextService({ ...GRN_TEST_CONTEXT, ...overrides });
}

export function makePoReference(
  overrides?: Partial<PurchaseOrderReference>,
): PurchaseOrderReference {
  return {
    id: 'po-1',
    orderNumber: 'PO-00000001',
    vendorId: 'vendor-1',
    status: 'ISSUED',
    currency: 'USD',
    subtotal: 0,
    total: 0,
    lines: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

export function makeGrnQueryRecord(overrides?: Partial<GrnQueryRecord>): GrnQueryRecord {
  return {
    id: 'grn-1',
    grnNumber: 'GRN-00000001',
    purchaseOrderId: 'po-1',
    vendorId: 'vendor-1',
    status: GrnStatus.DRAFT,
    currency: 'USD',
    subtotal: 0,
    total: 0,
    lines: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as unknown as GrnQueryRecord;
}
