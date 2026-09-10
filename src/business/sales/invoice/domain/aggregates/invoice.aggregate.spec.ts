import { InvoiceFactory } from '../factories/invoice.factory';
import { InvoiceStatus } from '../types/invoice.enum';

function createInput() {
  return {
    invoiceNo: 'inv-00000001',
    customerId: '3f0c6a1d-2b7c-4a11-9e77-1a2b3c4d5e6f',
    currency: 'USD',
    lines: [
      { description: 'Consulting', quantity: 3, unitPrice: 100.5 },
      { description: 'Retainer', quantity: 1, unitPrice: 500 },
    ],
  };
}

describe('Invoice aggregate', () => {
  it('creates a DRAFT invoice raising InvoiceCreated', () => {
    const invoice = InvoiceFactory.create(createInput());

    expect(invoice.status).toBe(InvoiceStatus.DRAFT);
    expect(invoice.invoiceNo).toBe('INV-00000001'); // normalized to uppercase
    const events = invoice.pullEvents();
    expect(events).toHaveLength(1);
    expect(events[0].constructor.name).toBe('InvoiceCreated');
    expect(invoice.pullEvents()).toHaveLength(0); // drained
  });

  it('computes the total from the lines (minor-unit money math)', () => {
    const invoice = InvoiceFactory.create(createInput());

    // 3 * 100.50 + 1 * 500.00 = 801.50
    expect(invoice.totalAmount().amount).toBeCloseTo(801.5, 2);
    expect(invoice.totalAmount().currency).toBe('USD');
  });

  it('rejects an invoice without lines', () => {
    expect(() => InvoiceFactory.create({ ...createInput(), lines: [] })).toThrow(
      /at least one line/,
    );
  });

  it('rejects non-positive quantities', () => {
    expect(() =>
      InvoiceFactory.create({
        ...createInput(),
        lines: [{ description: 'x', quantity: 0, unitPrice: 10 }],
      }),
    ).toThrow(/quantity must be positive/);
  });

  it('rejects an invalid document number', () => {
    expect(() => InvoiceFactory.create({ ...createInput(), invoiceNo: 'BOGUS' })).toThrow(
      /must match INV-/,
    );
  });

  it('posts a draft invoice, stamps postedAt and raises InvoicePosted once', () => {
    const invoice = InvoiceFactory.create(createInput());
    invoice.pullEvents();

    invoice.post();

    expect(invoice.status).toBe(InvoiceStatus.POSTED);
    expect(invoice.postedAt).toBeInstanceOf(Date);
    const events = invoice.pullEvents();
    expect(events).toHaveLength(1);
    expect(events[0].constructor.name).toBe('InvoicePosted');

    // re-posting is a no-op (no duplicate events)
    invoice.post();
    expect(invoice.pullEvents()).toHaveLength(0);
    expect(invoice.status).toBe(InvoiceStatus.POSTED);
  });
});
