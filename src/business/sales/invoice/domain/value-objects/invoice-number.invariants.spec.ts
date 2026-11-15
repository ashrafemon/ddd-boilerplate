import { InvoiceNumberInvariants } from './invoice-number.invariants';

describe('InvoiceNumberInvariants', () => {
  it('accepts a valid invoice number', () => {
    expect(() => InvoiceNumberInvariants.enforceInvoiceNumberFormat('INV-00000001')).not.toThrow();
  });

  it('rejects an empty number', () => {
    expect(() => InvoiceNumberInvariants.enforceInvoiceNumberFormat('')).toThrow(
      'Invoice number must match INV-<identifier>',
    );
  });

  it('rejects a missing INV- prefix', () => {
    expect(() => InvoiceNumberInvariants.enforceInvoiceNumberFormat('00000001')).toThrow(
      'Invoice number must match INV-<identifier>',
    );
  });

  it('rejects lowercase', () => {
    expect(() => InvoiceNumberInvariants.enforceInvoiceNumberFormat('inv-1')).toThrow(
      'Invoice number must match INV-<identifier>',
    );
  });
});
