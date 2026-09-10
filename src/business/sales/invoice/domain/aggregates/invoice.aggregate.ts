import { AggregateRoot } from '@business/shared-business/domain/bases/aggregate.base';
import { Money } from '@business/shared-business/domain/common/value-objects/money';
import { invariantRegistry } from '@business/shared-business/domain/registries/invariant.registry';
import { InvoicePosted } from '../events/invoice.posted.event';
import { InvoiceId } from '../value-objects/invoice-id.vo';
import { InvoiceLine } from '../value-objects/invoice-line.vo';
import { InvoiceStatus } from '../types/invoice.enum';
import { InvoiceProps } from '../types/invoice.types';

/**
 * Invoice aggregate root. DRAFT → POSTED is the only sanctioned state change
 * (via `post()`); the total is always derived from the lines, never set.
 */
export class Invoice extends AggregateRoot<InvoiceId> {
  private props: InvoiceProps;

  private constructor(id: InvoiceId, props: InvoiceProps, version: number) {
    super(id);
    this.props = props;
    this.version = version;
  }

  /** Construction entry point reserved for the domain factory. */
  static instantiate(id: InvoiceId, props: InvoiceProps, version: number): Invoice {
    return new Invoice(id, props, version);
  }

  get invoiceNo(): string {
    return this.props.invoiceNo.value;
  }

  get customerId(): string {
    return this.props.customerId;
  }

  get status(): InvoiceStatus {
    return this.props.status;
  }

  get currency(): string {
    return this.props.currency;
  }

  get lines(): readonly InvoiceLine[] {
    return this.props.lines;
  }

  get postedAt(): Date | null {
    return this.props.postedAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  totalAmount(): Money {
    return this.props.lines.reduce((sum, line) => sum.add(line.total()), Money.ZERO(this.currency));
  }

  post(): void {
    invariantRegistry.enforce<{ status: InvoiceStatus; to: InvoiceStatus }>(
      'invoice.status-transition',
      { status: this.props.status, to: InvoiceStatus.POSTED },
    );
    if (this.props.status === InvoiceStatus.POSTED) {
      return;
    }
    const now = new Date();
    this.props.status = InvoiceStatus.POSTED;
    this.props.postedAt = now;
    this.props.updatedAt = now;
    this.addEvent(new InvoicePosted(this.id, this.props.invoiceNo.value, now));
  }
}
