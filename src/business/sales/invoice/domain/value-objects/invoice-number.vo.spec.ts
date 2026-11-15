import { InvoiceNumber } from './invoice-number.vo';

describe('InvoiceNumber', () => {
  it('normalizes to upper-case and trims', () => {
    expect(InvoiceNumber.create('  inv-00000001  ').value).toBe('INV-00000001');
  });

  it('stringifies to its value', () => {
    expect(InvoiceNumber.create('INV-1').toString()).toBe('INV-1');
  });

  it('rejects an invalid format', () => {
    expect(() => InvoiceNumber.create('nope')).toThrow(
      'Invoice number must match INV-<identifier>',
    );
  });

  it('compares equal numbers', () => {
    expect(InvoiceNumber.create('INV-1').equals(InvoiceNumber.create('inv-1'))).toBe(true);
  });
});
