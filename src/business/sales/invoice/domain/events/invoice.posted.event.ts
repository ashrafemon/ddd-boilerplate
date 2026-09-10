import { DomainEvent } from '@business/shared-business/domain/bases/event.base';
import { InvoiceId } from '../value-objects/invoice-id.vo';

export class InvoicePosted extends DomainEvent {
  constructor(
    public readonly invoiceId: InvoiceId,
    public readonly invoiceNo: string,
    public readonly postedAt: Date,
  ) {
    super();
  }
}
