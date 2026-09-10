import { InvoiceId } from '../../../domain/value-objects/invoice-id.vo';

/** Typed wire shape of the invoice.posted integration event. */
export class InvoicePostedIntegrationEvent {
  constructor(
    public eventId: string,
    public eventType: 'invoice.posted',
    public occurredAt: string,
    public readonly invoiceId: InvoiceId,
    public readonly invoiceNo: string,
    public readonly postedAt: string,
  ) {}
}
