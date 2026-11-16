import { Money } from '@business/shared-business/domain/common/value-objects/money';
import { PurchaseOrder } from './purchase-order.aggregate';
import { PurchaseOrderId } from '../value-objects/purchase-order-id.vo';
import { OrderNumber } from '../value-objects/order-number.vo';
import { VendorIdRef } from '../value-objects/vendor-id-ref.vo';
import { PurchaseOrderStatus } from '../types/purchase-order.enum';

function makeOrder(status: PurchaseOrderStatus = PurchaseOrderStatus.DRAFT): PurchaseOrder {
  const now = new Date();
  return PurchaseOrder.instantiate(
    PurchaseOrderId.fromString('po-1'),
    {
      orderNumber: OrderNumber.create('PO-00000001'),
      vendorId: new VendorIdRef('v-1'),
      status,
      currency: 'USD',
      lines: [],
      createdAt: now,
      updatedAt: now,
    },
    1,
  );
}

const usd = (value: number) => Money.fromDecimal(value, 'USD');

describe('PurchaseOrder aggregate', () => {
  describe('lines', () => {
    it('adds a line and computes the total', () => {
      const order = makeOrder();
      order.addLine('p-1', 2, usd(5));
      expect(order.lines).toHaveLength(1);
      expect(order.total.toDecimal()).toBe('10.00');
    });

    it('merges a repeated product into the existing line', () => {
      const order = makeOrder();
      order.addLine('p-1', 2, usd(5));
      order.addLine('p-1', 3, usd(5));
      expect(order.lines).toHaveLength(1);
      expect(order.lines[0].quantity).toBe(5);
    });

    it('rejects a non-positive quantity', () => {
      const order = makeOrder();
      expect(() => order.addLine('p-1', 0, usd(5))).toThrow(
        'Line quantity must be a positive integer',
      );
    });

    it('setLine returns false when nothing changes', () => {
      const order = makeOrder();
      order.addLine('p-1', 2, usd(5));
      expect(order.setLine('p-1', 2, usd(5))).toBe(false);
    });

    it('removes a line', () => {
      const order = makeOrder();
      order.addLine('p-1', 2, usd(5));
      order.removeLine('p-1');
      expect(order.lines).toHaveLength(0);
    });

    it('rejects line changes outside DRAFT', () => {
      const order = makeOrder(PurchaseOrderStatus.SUBMITTED);
      expect(() => order.addLine('p-1', 1, usd(5))).toThrow('only DRAFT orders are editable');
    });
  });

  describe('status transitions', () => {
    it('submits an order with lines', () => {
      const order = makeOrder();
      order.addLine('p-1', 1, usd(5));
      order.submit();
      expect(order.status).toBe(PurchaseOrderStatus.SUBMITTED);
    });

    it('rejects submitting an empty order', () => {
      const order = makeOrder();
      expect(() => order.submit()).toThrow('must contain at least one line');
    });

    it('approves a submitted order and records the actor', () => {
      const order = makeOrder();
      order.addLine('p-1', 1, usd(5));
      order.submit();
      order.approve('approver-1');
      expect(order.status).toBe(PurchaseOrderStatus.APPROVED);
      expect(order.approvedBy).toBe('approver-1');
      expect(order.approvedAt).toBeInstanceOf(Date);
    });

    it('rejects a submitted order with a reason', () => {
      const order = makeOrder();
      order.addLine('p-1', 1, usd(5));
      order.submit();
      order.reject('price too high', 'approver-1');
      expect(order.status).toBe(PurchaseOrderStatus.REJECTED);
      expect(order.rejectionReason).toBe('price too high');
    });

    it('cancels a draft order', () => {
      const order = makeOrder();
      order.cancel('actor-1');
      expect(order.status).toBe(PurchaseOrderStatus.CANCELLED);
      expect(order.cancelledBy).toBe('actor-1');
    });

    it('rejects cancelling with posted receipts', () => {
      const order = makeOrder();
      expect(() => order.cancel('actor-1', true)).toThrow(
        'Cannot cancel a purchase order with posted receipts',
      );
    });
  });

  describe('header', () => {
    it('updates header fields while editable', () => {
      const order = makeOrder();
      const expected = new Date('2027-01-01T00:00:00Z');
      order.updateHeader({ expectedDeliveryDate: expected, externalReference: 'EXT-1' });
      expect(order.expectedDeliveryDate).toEqual(expected);
      expect(order.externalReference).toBe('EXT-1');
    });

    it('rejects header updates outside DRAFT', () => {
      const order = makeOrder(PurchaseOrderStatus.SUBMITTED);
      expect(() => order.updateHeader({ externalReference: 'EXT-1' })).toThrow(
        'only DRAFT orders are editable',
      );
    });
  });
});
