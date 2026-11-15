import { PurchaseOrderIdRef } from './purchase-order-id-ref.vo';

describe('PurchaseOrderIdRef', () => {
  it('wraps a string value', () => {
    expect(new PurchaseOrderIdRef('po-1').value).toBe('po-1');
  });

  it('stringifies and compares', () => {
    expect(new PurchaseOrderIdRef('a').toString()).toBe('a');
    expect(new PurchaseOrderIdRef('a').equals(new PurchaseOrderIdRef('a'))).toBe(true);
    expect(new PurchaseOrderIdRef('a').equals(undefined)).toBe(false);
  });
});
