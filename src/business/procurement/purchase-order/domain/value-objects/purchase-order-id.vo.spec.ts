import { PurchaseOrderId } from './purchase-order-id.vo';

describe('PurchaseOrderId', () => {
  it('wraps a string value', () => {
    expect(PurchaseOrderId.fromString('po-1').value).toBe('po-1');
  });

  it('generates a UUID', () => {
    expect(PurchaseOrderId.generate().value).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('generates unique ids', () => {
    expect(PurchaseOrderId.generate().value).not.toBe(PurchaseOrderId.generate().value);
  });

  it('stringifies and compares', () => {
    expect(PurchaseOrderId.fromString('a').toString()).toBe('a');
    expect(PurchaseOrderId.fromString('a').equals(PurchaseOrderId.fromString('a'))).toBe(true);
    expect(PurchaseOrderId.fromString('a').equals(undefined)).toBe(false);
  });
});
