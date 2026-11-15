import { InvoiceId } from '../value-objects/invoice-id.vo';
import { InvoiceCreated } from './invoice.created.event';
import { InvoicePosted } from './invoice.posted.event';

describe('Invoice domain events', () => {
  it('InvoiceCreated carries the invoice number', () => {
    const event = new InvoiceCreated(
      InvoiceId.fromString('inv-1'),
      'INV-00000001',
      'customer-1',
      1000,
      'USD',
    );
    expect(event.invoiceNo).toBe('INV-00000001');
    expect(event.customerId).toBe('customer-1');
    expect(event.totalAmount).toBe(1000);
    expect(event.currency).toBe('USD');
    expect(event.eventId).toBeTruthy();
    expect(event.occurredAt).toBeInstanceOf(Date);
    expect(event.version).toBe(1);
  });

  it('InvoicePosted carries the posted timestamp', () => {
    const postedAt = new Date('2026-01-01T00:00:00.000Z');
    const event = new InvoicePosted(InvoiceId.fromString('inv-1'), 'INV-1', postedAt);
    expect(event.invoiceNo).toBe('INV-1');
    expect(event.postedAt).toEqual(postedAt);
  });
});
