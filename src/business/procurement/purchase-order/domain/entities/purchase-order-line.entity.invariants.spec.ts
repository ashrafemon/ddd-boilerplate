import { PurchaseOrderLineInvariants } from './purchase-order-line.entity.invariants';

describe('PurchaseOrderLineInvariants', () => {
  it('accepts a positive integer quantity', () => {
    expect(() => PurchaseOrderLineInvariants.enforcePurchaseOrderLineQuantity(1)).not.toThrow();
  });

  it('rejects zero', () => {
    expect(() => PurchaseOrderLineInvariants.enforcePurchaseOrderLineQuantity(0)).toThrow(
      'Line quantity must be a positive integer',
    );
  });

  it('rejects a negative quantity', () => {
    expect(() => PurchaseOrderLineInvariants.enforcePurchaseOrderLineQuantity(-1)).toThrow(
      'Line quantity must be a positive integer',
    );
  });

  it('rejects a non-integer quantity', () => {
    expect(() => PurchaseOrderLineInvariants.enforcePurchaseOrderLineQuantity(1.5)).toThrow(
      'Line quantity must be a positive integer',
    );
  });
});
