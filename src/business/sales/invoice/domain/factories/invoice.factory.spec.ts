import { Money } from '@business/shared-business/domain/common/value-objects/money';
import { InvoiceFactory } from './invoice.factory';
import { InvoiceStatus } from '../types/invoice.enum';

describe('InvoiceFactory', () => {
  const base = {
    invoiceNo: 'INV-00000001',
    customerId: 'customer-1',
    currency: 'USD',
    lines: [{ description: 'Widget', quantity: 2, unitPrice: 10.5 }],
  };

  it('creates a DRAFT invoice', () => {
    const invoice = InvoiceFactory.create(base);
    expect(invoice.status).toBe(InvoiceStatus.DRAFT);
    expect(invoice.invoiceNo).toBe('INV-00000001');
    expect(invoice.lines).toHaveLength(1);
  });

  it('raises InvoiceCreated', () => {
    const invoice = InvoiceFactory.create(base);
    expect(invoice.pullEvents()).toHaveLength(1);
  });

  it('rejects an empty line set', () => {
    expect(() => InvoiceFactory.create({ ...base, lines: [] })).toThrow(
      'Invoice must have at least one line',
    );
  });

  it('rejects a non-positive line quantity', () => {
    expect(() =>
      InvoiceFactory.create({
        ...base,
        lines: [{ description: 'W', quantity: 0, unitPrice: 10 }],
      }),
    ).toThrow('Invoice line quantity must be positive');
  });

  it('rejects an invalid invoice number', () => {
    expect(() => InvoiceFactory.create({ ...base, invoiceNo: 'nope' })).toThrow(
      'Invoice number must match INV-<identifier>',
    );
  });

  it('rejects a negative price', () => {
    expect(() =>
      InvoiceFactory.create({
        ...base,
        lines: [{ description: 'W', quantity: 1, unitPrice: -1 }],
      }),
    ).toThrow();
    // Money.fromDecimal rejects negatives before the invoice invariant runs
    expect(Money.fromDecimal(1, 'USD').minorUnits).toBe(100);
  });
});
