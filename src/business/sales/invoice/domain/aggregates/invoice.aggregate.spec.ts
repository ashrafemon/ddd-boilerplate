import { InvoiceFactory } from '../factories/invoice.factory';
import { InvoiceStatus } from '../types/invoice.enum';
import { Invoice } from './invoice.aggregate';
import { InvoiceId } from '../value-objects/invoice-id.vo';
import { InvoiceNumber } from '../value-objects/invoice-number.vo';

function makeInvoice() {
  const invoice = InvoiceFactory.create({
    invoiceNo: 'INV-00000001',
    customerId: 'customer-1',
    currency: 'USD',
    lines: [{ description: 'Widget', quantity: 2, unitPrice: 10.5 }],
  });
  invoice.pullEvents(); // drain the creation event
  return invoice;
}

describe('Invoice aggregate', () => {
  it('exposes its header props', () => {
    const invoice = makeInvoice();
    expect(invoice.invoiceNo).toBe('INV-00000001');
    expect(invoice.customerId).toBe('customer-1');
    expect(invoice.status).toBe(InvoiceStatus.DRAFT);
    expect(invoice.currency).toBe('USD');
    expect(invoice.lines).toHaveLength(1);
    expect(invoice.postedAt).toBeNull();
  });

  it('computes the total amount across lines', () => {
    const invoice = InvoiceFactory.create({
      invoiceNo: 'INV-00000002',
      customerId: 'c',
      currency: 'USD',
      lines: [
        { description: 'A', quantity: 2, unitPrice: 10.5 },
        { description: 'B', quantity: 1, unitPrice: 5 },
      ],
    });
    expect(invoice.totalAmount().minorUnits).toBe(2600);
  });

  describe('post', () => {
    it('posts a draft invoice and stamps postedAt', () => {
      const invoice = makeInvoice();
      invoice.post();
      expect(invoice.status).toBe(InvoiceStatus.POSTED);
      expect(invoice.postedAt).toBeInstanceOf(Date);
    });

    it('raises InvoicePosted', () => {
      const invoice = makeInvoice();
      invoice.post();
      expect(invoice.pullEvents()).toHaveLength(1);
    });

    it('is idempotent for an already-posted invoice', () => {
      const invoice = makeInvoice();
      invoice.post();
      invoice.pullEvents(); // drain the first post event
      expect(() => invoice.post()).not.toThrow();
      expect(invoice.pullEvents()).toHaveLength(0);
    });

    it('rejects posting with no lines', () => {
      const invoice = Invoice.instantiate(
        InvoiceId.generate(),
        {
          invoiceNo: InvoiceNumber.create('INV-1'),
          customerId: 'c',
          status: InvoiceStatus.DRAFT,
          currency: 'USD',
          lines: [],
          postedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        1,
      );
      expect(() => invoice.post()).toThrow('Invoice must have at least one line to post');
      expect(invoice.lines).toHaveLength(0);
    });
  });
});
