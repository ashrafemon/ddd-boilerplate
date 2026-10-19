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

  it('requires manual approval for high-value orders and auto-approves low-value', () => {
    const withHighValueLine = (po: PurchaseOrder) => {
      po.addLine('product-1', 1000, Money.fromDecimal('500.00'));
      return po;
    };

    // High-value: requiresManualApproval returns true; approve() still works
    // (the use case throws ConflictException before calling approve).
    const highValue = withHighValueLine(create());
    highValue.pullEvents();
    highValue.submit();
    highValue.pullEvents();
    expect(highValue.requiresManualApproval(10_000)).toBe(true);
    expect(() => highValue.approve()).not.toThrow();

    // Low-value: auto-approvable.
    const lowValue = withLine(create());
    lowValue.pullEvents();
    lowValue.submit();
    lowValue.pullEvents();
    expect(lowValue.requiresManualApproval(10_000)).toBe(false);
    lowValue.approve();
    lowValue.pullEvents();
    expect(lowValue.status).toBe(PurchaseOrderStatus.APPROVED);
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

  describe('lifecycle to ERP shape (Phase 2)', () => {
    const approved = () => {
      const po = withLine(create());
      po.pullEvents();
      po.submit();
      po.pullEvents();
      po.approve('approver-1');
      po.pullEvents();
      return po;
    };

    it('issues an APPROVED order with at least one line and stamps issuedBy', () => {
      const po = approved();
      po.issue('issuer-1');
      expect(po.status).toBe(PurchaseOrderStatus.ISSUED);
      expect(po.issuedBy).toBe('issuer-1');
    });

    it('cannot issue an order without lines (PO-02)', () => {
      const empty = create();
      empty.pullEvents();
      // has-lines is enforced before the status transition.
      expect(() => empty.issue()).toThrow();
      expect(empty.status).toBe(PurchaseOrderStatus.DRAFT);
    });

    it('closes an ISSUED order to COMPLETED; legacy complete delegates to close', () => {
      const po = approved();
      po.issue();
      po.pullEvents();
      po.close();
      expect(po.status).toBe(PurchaseOrderStatus.COMPLETED);
    });

    it('ISSUED is terminal except COMPLETED — cancel is not allowed (E-1)', () => {
      const po = approved();
      po.issue();
      expect(() => po.cancel('someone')).toThrow();
    });

    it('DRAFT/SUBMITTED/APPROVED orders are cancellable without receipts and stamp cancelledBy', () => {
      const po = approved();
      po.cancel('someone', false);
      expect(po.status).toBe(PurchaseOrderStatus.CANCELLED);
      expect(po.cancelledBy).toBe('someone');
    });
  });

  describe('CancellationPolicy (Phase 2.4)', () => {
    it('blocks cancellation when the PO has posted receipts', () => {
      const po = withLine(create());
      po.pullEvents();
      po.submit();
      po.pullEvents();
      po.approve();
      expect(() => po.cancel('someone', true)).toThrow();
      expect(po.status).toBe(PurchaseOrderStatus.APPROVED);
      expect(po.cancelledBy).toBeNull();
    });

    it('allows cancellation when nothing was received', () => {
      const po = withLine(create());
      po.pullEvents();
      po.submit();
      po.pullEvents();
      po.approve();
      expect(() => po.cancel('someone', false)).not.toThrow();
    });
  });

  describe('draft header + line snapshots (Phase 2.2 / spec §3.1–3.3)', () => {
    it('updates header fields only while DRAFT', () => {
      const po = withLine(create());
      const expected = new Date('2026-12-01T00:00:00.000Z');
      po.updateHeader({ expectedDeliveryDate: expected, externalReference: 'EXT-9' });
      expect(po.expectedDeliveryDate).toEqual(expected);
      expect(po.externalReference).toBe('EXT-9');

      po.pullEvents();
      po.submit();
      expect(() => po.updateHeader({ externalReference: 'EXT-10' })).toThrow();
    });

    it('snapshots the product description on a new line and keeps it when the quantity changes', () => {
      const po = create();
      po.addLine('product-1', 2, Money.fromDecimal('10.00'), 'Widget A');
      expect(po.lines[0].descriptionSnapshot).toBe('Widget A');

      po.setLine('product-1', 5, Money.fromDecimal('4.00'), 'Renamed Widget');
      // setLine only stamps a description when it CREATES the line — an
      // existing snapshot is commercial history and never rewritten.
      expect(po.lines[0].descriptionSnapshot).toBe('Widget A');
      expect(po.lines[0].quantity).toBe(5);
    });

    it('orderDate defaults to creation day', () => {
      expect(create().orderDate).toBeInstanceOf(Date);
    });
  });
});
