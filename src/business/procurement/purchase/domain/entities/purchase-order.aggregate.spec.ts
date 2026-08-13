import { PurchaseOrder, PurchaseOrderStatus } from './purchase-order.aggregate';
import { Money } from '@business/shared-business/domain/money.value-object';
import { PurchaseOrderApproved, PurchaseOrderSubmitted } from '../events';
import { InvariantException } from '@business/shared-business/errors';
import { policyRegistry } from '@business/shared-business/domain/policies';
import { purchaseOrderFactory } from '../factories';

describe('PurchaseOrder aggregate', () => {
  const create = () =>
    purchaseOrderFactory.create({
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
    expect(() => po.submit()).toThrow(InvariantException);
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
    expect(() => empty.approve()).toThrow(InvariantException);

    po.approve();
    po.pullEvents();
    expect(() => po.reject('nope')).toThrow(InvariantException);
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

  it('evaluates approval policy threshold', () => {
    const small = withLine(create());
    small.submit();
    expect(
      policyRegistry.evaluate('purchase-order.approval', {
        status: small.status,
        totalAmount: small.total.amount,
        autoApproveThreshold: 10000,
      }).ok,
    ).toBe(true);

    const big = create();
    big.addLine('product-1', 2000, Money.fromDecimal('10.00'));
    big.submit();
    const result = policyRegistry.evaluate('purchase-order.approval', {
      status: big.status,
      totalAmount: big.total.amount,
      autoApproveThreshold: 10000,
    });
    expect(result.ok).toBe(true);
    expect(result.ok && result.value).toBe(true);
  });
});
