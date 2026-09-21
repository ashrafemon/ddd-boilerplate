import { PurchaseOrder } from './purchase-order.aggregate';
import { PurchaseOrderStatus } from '../types/purchase-order.enum';
import { Money } from '@business/shared-business/domain/common/value-objects/money';
import { PurchaseOrderApproved } from '../events/purchase-order.approved.event';
import { PurchaseOrderSubmitted } from '../events/purchase-order.submitted.event';
import { policyRegistry } from '@business/shared-business/domain/registries/policy.registry';
import { PurchaseOrderFactory } from '../factories/purchase-order.factory';

describe('PurchaseOrder aggregate', () => {
  const create = () =>
    PurchaseOrderFactory.create({
      orderNumber: 'PO-00000001',
      vendorId: 'vendor-1',
      currency: 'USD',
    });

  const withLine = (po: PurchaseOrder) => {
    po.addLine('product-1', 2, Money.fromDecimal('10.00'));
    po.addLine('product-2', 1, Money.fromDecimal('5.00'));
    return po;
  };

  it('creates a draft order', () => {
    const po = create();
    expect(po.status).toBe(PurchaseOrderStatus.DRAFT);
    expect(po.total.minorUnits).toBe(0);
  });

  it('computes line totals and order total', () => {
    const po = withLine(create());
    expect(po.total.amount).toBe(25);
    expect(po.lines).toHaveLength(2);
  });

  it('cannot submit without lines', () => {
    const po = create();
    expect(() => po.submit()).toThrow();
  });

  it('submits then approves and raises events', () => {
    const po = withLine(create());
    po.pullEvents();

    po.submit();
    expect(po.status).toBe(PurchaseOrderStatus.SUBMITTED);
    expect(po.pullEvents().some(e => e instanceof PurchaseOrderSubmitted)).toBe(true);

    po.approve();
    expect(po.status).toBe(PurchaseOrderStatus.APPROVED);
    expect(po.pullEvents().some(e => e instanceof PurchaseOrderApproved)).toBe(true);
  });

  it('rejects invalid transitions', () => {
    const po = withLine(create());
    po.pullEvents();

    po.submit();
    po.pullEvents();
    // A DRAFT-only order (no lines) cannot jump to APPROVED.
    const empty = create();
    empty.pullEvents();
    expect(() => empty.approve()).toThrow();

    po.approve();
    po.pullEvents();
    expect(() => po.reject('nope')).toThrow();
  });

  it('cannot modify a submitted order', () => {
    const po = withLine(create());
    po.pullEvents();
    po.submit();
    expect(() => po.addLine('product-3', 1, Money.fromDecimal('1.00'))).toThrow();
  });

  it('merges duplicate lines by quantity', () => {
    const po = create();
    po.addLine('product-1', 2, Money.fromDecimal('10.00'));
    po.addLine('product-1', 3, Money.fromDecimal('10.00'));
    expect(po.lines).toHaveLength(1);
    expect(po.lines[0].quantity).toBe(5);
  });

  describe('setLine (idempotent import write)', () => {
    it('adds a new line and raises LineAdded', () => {
      const po = create();
      po.pullEvents();
      expect(po.setLine('product-1', 2, Money.fromDecimal('10.00'))).toBe(true);
      expect(po.lines).toHaveLength(1);
      expect(po.total.amount).toBe(20);
      expect(po.pullEvents()).toHaveLength(1);
    });

    it('replaces (never sums) an existing line', () => {
      const po = create();
      po.setLine('product-1', 2, Money.fromDecimal('10.00'));
      expect(po.setLine('product-1', 5, Money.fromDecimal('4.00'))).toBe(true);
      expect(po.lines).toHaveLength(1);
      expect(po.lines[0].quantity).toBe(5);
      expect(po.total.amount).toBe(20);
    });

    it('is a no-op (no event) when the line is already in that state', () => {
      const po = create();
      po.setLine('product-1', 2, Money.fromDecimal('10.00'));
      po.pullEvents();
      expect(po.setLine('product-1', 2, Money.fromDecimal('10.00'))).toBe(false);
      expect(po.pullEvents()).toHaveLength(0);
    });

    it('rejects a non-editable order and a zero quantity', () => {
      const po = withLine(create());
      expect(() => po.setLine('product-9', 0, Money.fromDecimal('1.00'))).toThrow();
      po.submit();
      expect(() => po.setLine('product-1', 9, Money.fromDecimal('1.00'))).toThrow();
    });
  });

  it('evaluates approval policy threshold', () => {
    const small = withLine(create());
    small.submit();
    expect(
      policyRegistry.evaluate('purchase-order.approval', {
        status: small.status,
        totalAmount: small.total.amount,
        autoApproveThreshold: 10000,
      }),
    ).toBe(false);

    const big = create();
    big.addLine('product-1', 2000, Money.fromDecimal('10.00'));
    big.submit();
    const passed = policyRegistry.evaluate('purchase-order.approval', {
      status: big.status,
      totalAmount: big.total.amount,
      autoApproveThreshold: 10000,
    });
    expect(passed).toBe(true);
  });
});
