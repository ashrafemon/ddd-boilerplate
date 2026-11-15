import { Money } from '@business/shared-business/domain/common/value-objects/money';
import { PurchaseOrderLine } from './purchase-order-line.entity';
import { ProductIdRef } from '../value-objects/product-id-ref.vo';

describe('PurchaseOrderLine', () => {
  const productId = new ProductIdRef('11111111-1111-1111-1111-111111111111');
  const unitPrice = Money.fromMinorUnits(500, 'USD');

  it('creates line with defaults', () => {
    const line = new PurchaseOrderLine(productId, 10, unitPrice, unitPrice.multiply(10));
    expect(line.quantity).toBe(10);
    expect(line.receivedQuantity).toBe(0);
    expect(line.descriptionSnapshot).toBeNull();
  });

  it('withUpdatedQuantity returns new line with updated quantity and price', () => {
    const line = new PurchaseOrderLine(productId, 10, unitPrice, unitPrice.multiply(10));
    const updated = line.withUpdatedQuantity(
      20,
      Money.fromMinorUnits(750, 'USD'),
      Money.fromMinorUnits(1500, 'USD'),
    );
    expect(updated.quantity).toBe(20);
    expect(updated.unitPrice.minorUnits).toBe(750);
    expect(updated.total.minorUnits).toBe(1500);
    // original unchanged
    expect(line.quantity).toBe(10);
  });

  it('receive applies delta to receivedQuantity', () => {
    const line = new PurchaseOrderLine(productId, 10, unitPrice, unitPrice.multiply(10));
    line.receive(3);
    expect(line.receivedQuantity).toBe(3);
    line.receive(2);
    expect(line.receivedQuantity).toBe(5);
  });

  it('receive applies negative delta (reversal)', () => {
    const line = new PurchaseOrderLine(productId, 10, unitPrice, unitPrice.multiply(10));
    line.receive(5);
    line.receive(-2);
    expect(line.receivedQuantity).toBe(3);
  });

  it('receive throws for non-integer delta', () => {
    const line = new PurchaseOrderLine(productId, 10, unitPrice, unitPrice.multiply(10));
    expect(() => line.receive(1.5)).toThrow('Received quantity delta must be an integer');
  });

  it('withReceivedQuantity returns new line preserving other fields', () => {
    const line = new PurchaseOrderLine(productId, 10, unitPrice, unitPrice.multiply(10));
    const updated = line.withReceivedQuantity(7);
    expect(updated.receivedQuantity).toBe(7);
    expect(updated.quantity).toBe(10);
    expect(updated.unitPrice.minorUnits).toBe(500);
  });
});
