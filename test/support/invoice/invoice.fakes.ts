import { InvoiceCommandRepository } from '@business/sales/invoice/domain/repositories/invoice-command.repository';
import { Invoice } from '@business/sales/invoice/domain/aggregates/invoice.aggregate';
import { InvoiceQuery } from '@business/sales/invoice/application/queries/invoice.query';
import { InvoicePublisherPort } from '@business/sales/invoice/application/publishes/publishers/invoice.publisher-port';
import { NumberingPort } from '@business/procurement/purchase-order/application/outbound-ports/numbering.port';
import { InvoiceQueryRecord } from '@business/sales/invoice/domain/types/invoice.types';
import { OutboxEvent } from '@platform/platform-common/outbox/outbox.types';
import {
  AbacPort,
  AbacCheck,
  AbacResult,
} from '@platform/platform-organization/authorization/ports/abac.port';
import { InMemoryRequestContextService } from '@test/support/context/in-memory-request-context';
import { PageQuery, PageResult } from '@common/application/types/pagination';

export const INVOICE_TEST_CONTEXT = {
  tenantId: 'tenant-1',
  companyId: 'company-1',
  userId: 'user-1',
  roles: ['admin'],
  defaultCurrency: 'USD',
};

export class InMemoryInvoiceRepository extends InvoiceCommandRepository {
  public readonly store = new Map<string, Invoice>();
  public readonly saved: Invoice[] = [];
  public readonly updates: Invoice[] = [];

  async findById(id: string): Promise<Invoice | null> {
    return this.store.get(id) ?? null;
  }
  async save(invoice: Invoice): Promise<Invoice> {
    this.saved.push(invoice);
    this.store.set(invoice.id.toString(), invoice);
    return invoice;
  }
  async update(invoice: Invoice): Promise<Invoice> {
    this.updates.push(invoice);
    this.store.set(invoice.id.toString(), invoice);
    return invoice;
  }
}

export class InMemoryInvoiceQuery extends InvoiceQuery {
  public readonly byId = new Map<string, InvoiceQueryRecord>();

  async findById(id: string): Promise<InvoiceQueryRecord | null> {
    return this.byId.get(id) ?? null;
  }
  async findAll(query: PageQuery): Promise<PageResult<InvoiceQueryRecord>> {
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

export class InMemoryInvoicePublisherPort extends InvoicePublisherPort {
  public readonly events: OutboxEvent[] = [];
  async send(event: OutboxEvent, _invoiceId: string): Promise<void> {
    this.events.push(event);
  }
}

export class InMemoryInvoiceNumberingPort extends NumberingPort {
  private counter = 0;
  async nextNumber(_key: string, options?: { prefix?: string; padding?: number }): Promise<string> {
    this.counter++;
    return `${options?.prefix ?? 'INV-'}${String(this.counter).padStart(options?.padding ?? 8, '0')}`;
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

export function makeInvoiceContext(
  overrides?: Record<string, unknown>,
): InMemoryRequestContextService {
  return new InMemoryRequestContextService({ ...INVOICE_TEST_CONTEXT, ...overrides });
}

export function makeInvoiceQueryRecord(
  overrides?: Partial<InvoiceQueryRecord>,
): InvoiceQueryRecord {
  return {
    id: 'inv-1',
    invoiceNo: 'INV-00000001',
    customerId: 'customer-1',
    status: 'DRAFT',
    currency: 'USD',
    totalAmount: 1000,
    lines: [],
    postedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}
