import { OrderNumberInvariants } from './order-number.invariants';

describe('OrderNumberInvariants', () => {
  it('accepts a valid order number', () => {
    expect(() => OrderNumberInvariants.enforceOrderNumberCreate('PO-00000001')).not.toThrow();
  });

  it('accepts any 2-32 char alphanumeric/dash value', () => {
    expect(() => OrderNumberInvariants.enforceOrderNumberCreate('AB')).not.toThrow();
    expect(() => OrderNumberInvariants.enforceOrderNumberCreate('A-1')).not.toThrow();
  });

  it('rejects an empty order number', () => {
    expect(() => OrderNumberInvariants.enforceOrderNumberCreate('   ')).toThrow(
      'Order number is required',
    );
  });

  it('rejects a too-short order number', () => {
    expect(() => OrderNumberInvariants.enforceOrderNumberCreate('A')).toThrow(
      'Order number must match PO-<identifier>',
    );
  });

  it('rejects a too-long order number', () => {
    expect(() => OrderNumberInvariants.enforceOrderNumberCreate('A'.repeat(33))).toThrow(
      'Order number must match PO-<identifier>',
    );
  });

  it('rejects illegal characters', () => {
    expect(() => OrderNumberInvariants.enforceOrderNumberCreate('PO 1')).toThrow(
      'Order number must match PO-<identifier>',
    );
    expect(() => OrderNumberInvariants.enforceOrderNumberCreate('PO_1')).toThrow(
      'Order number must match PO-<identifier>',
    );
  });
});
