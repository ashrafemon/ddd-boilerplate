import { InvoiceFactory } from '@business/sales/invoice/domain/factories/invoice.factory';
import { InvoiceCreated } from '@business/sales/invoice/domain/events/invoice.created.event';
import { InvoicePosted } from '@business/sales/invoice/domain/events/invoice.posted.event';

describe('Invoice events — wire contract', () => {
  function draftInvoice() {
    return InvoiceFactory.create({
      invoiceNo: 'INV-1000',
      customerId: 'customer-1',
      currency: 'USD',
      lines: [{ description: 'Widget', quantity: 2, unitPrice: 10 }],
    });
  }

  it('publishes InvoiceCreated under a stable event type name', () => {
    const [event] = draftInvoice().pullEvents() as InvoiceCreated[];

    expect(event.constructor.name).toBe('InvoiceCreated');
    expect(typeof event.eventId).toBe('string');
    expect(event.eventId.length).toBeGreaterThan(0);
    expect(Number.isInteger(event.version)).toBe(true);
    expect(event.version).toBeGreaterThanOrEqual(1);
    expect(event.occurredAt).toBeInstanceOf(Date);
  });

  it('publishes InvoicePosted with its own type name and the invoice identity', () => {
    const invoice = draftInvoice();
    invoice.pullEvents();

    invoice.post();
    const [posted] = invoice.pullEvents() as InvoicePosted[];

    expect(posted.constructor.name).toBe('InvoicePosted');
    expect(typeof posted.invoiceId.toString()).toBe('string');
    expect(posted.invoiceNo).toBe('INV-1000');
    expect(posted.postedAt).toBeInstanceOf(Date);
  });

  it('keeps created and posted distinguishable by event type for consumers', () => {
    const invoice = draftInvoice();
    const created = invoice.pullEvents()[0] as InvoiceCreated;
    invoice.post();
    const posted = invoice.pullEvents()[0] as InvoicePosted;

    expect(created.constructor.name).not.toBe(posted.constructor.name);
    expect(created.eventId).not.toBe(posted.eventId);
  });

  it('survives JSON serialisation without losing consumer fields', () => {
    const [event] = draftInvoice().pullEvents() as InvoiceCreated[];

    const serialised = JSON.parse(JSON.stringify(event)) as Record<string, unknown>;
    expect(serialised.invoiceId).toBeDefined();
    expect(serialised.invoiceNo).toBe('INV-1000');
    expect(typeof serialised.occurredAt).toBe('string');
  });
});
