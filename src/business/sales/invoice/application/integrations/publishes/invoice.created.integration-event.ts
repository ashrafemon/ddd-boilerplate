import { InvoiceId } from '../../../domain/value-objects/invoice-id.vo';

/** Typed wire shape of the invoice.created integration event. */
export class InvoiceCreatedIntegrationEvent {
  constructor(
    public eventId: string,
    public eventType: 'invoice.created',
    public occurredAt: string,
    public readonly invoiceId: InvoiceId,
    public readonly invoiceNo: string,
    public readonly customerId: string,
    public readonly totalAmount: number,
    public readonly currency: string,
  ) {}
}
