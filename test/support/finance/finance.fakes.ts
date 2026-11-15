import {
  JournalEntryRepository,
  PayableOpenItemRepository,
  PaymentRepository,
  VendorBillRepository,
} from '@business/finance/domain/repositories/finance.repository';
import { JournalEntry } from '@business/finance/domain/aggregates/journal-entry.aggregate';
import { Payment } from '@business/finance/domain/entities/payment.entity';
import { PayableOpenItem } from '@business/finance/domain/entities/payable-open-item.entity';
import { VendorBill } from '@business/finance/domain/entities/vendor-bill.entity';
import { FinancePublisherPort } from '@business/finance/application/publishes/publishers/finance.publisher-port';
import { OutboxEvent } from '@platform/platform-common/outbox/outbox.types';
import { AuditEntry, AuditPort } from '@platform/platform-common/audit/ports/audit.port';
import {
  AbacPort,
  AbacCheck,
  AbacResult,
} from '@platform/platform-organization/authorization/ports/abac.port';
import { InMemoryRequestContextService } from '@test/support/context/in-memory-request-context';

export const FINANCE_TEST_CONTEXT = {
  tenantId: 'tenant-1',
  companyId: 'company-1',
  userId: 'user-1',
  roles: ['admin'],
  defaultCurrency: 'USD',
};

export class InMemoryJournalEntryRepository extends JournalEntryRepository {
  public readonly saved: JournalEntry[] = [];
  async findById(): Promise<JournalEntry | null> {
    return null;
  }
  async findByEntryNo(): Promise<JournalEntry | null> {
    return null;
  }
  async save(entry: JournalEntry): Promise<JournalEntry> {
    this.saved.push(entry);
    return entry;
  }
  async update(entry: JournalEntry): Promise<JournalEntry> {
    return entry;
  }
}

export class InMemoryVendorBillRepository extends VendorBillRepository {
  public readonly saved: VendorBill[] = [];
  async findById(): Promise<VendorBill | null> {
    return null;
  }
  async findByBillNo(): Promise<VendorBill | null> {
    return null;
  }
  async save(bill: VendorBill): Promise<VendorBill> {
    this.saved.push(bill);
    return bill;
  }
  async update(bill: VendorBill): Promise<VendorBill> {
    return bill;
  }
}

export class InMemoryPaymentRepository extends PaymentRepository {
  public readonly saved: Payment[] = [];
  async findById(): Promise<Payment | null> {
    return null;
  }
  async findByPaymentNo(): Promise<Payment | null> {
    return null;
  }
  async save(payment: Payment): Promise<Payment> {
    this.saved.push(payment);
    return payment;
  }
  async update(payment: Payment): Promise<Payment> {
    return payment;
  }
}

export class InMemoryPayableOpenItemRepository extends PayableOpenItemRepository {
  public readonly saved: PayableOpenItem[] = [];
  async findByVendor(): Promise<PayableOpenItem[]> {
    return [];
  }
  async save(item: PayableOpenItem): Promise<PayableOpenItem> {
    this.saved.push(item);
    return item;
  }
  async update(item: PayableOpenItem): Promise<PayableOpenItem> {
    return item;
  }
}

export class InMemoryFinancePublisherPort extends FinancePublisherPort {
  public readonly events: OutboxEvent[] = [];
  async send(event: OutboxEvent, _aggregateId: string): Promise<void> {
    this.events.push(event);
  }
}

export class InMemoryFinanceAuditPort extends AuditPort {
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

export function makeFinanceContext(
  overrides?: Record<string, unknown>,
): InMemoryRequestContextService {
  return new InMemoryRequestContextService({ ...FINANCE_TEST_CONTEXT, ...overrides });
}
