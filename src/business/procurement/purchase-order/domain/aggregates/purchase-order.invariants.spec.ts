import { PurchaseOrderInvariants } from './purchase-order.invariants';
import { PurchaseOrderStatus } from '../types/purchase-order.enum';

describe('PurchaseOrderInvariants', () => {
  describe('enforcePurchaseOrderCreate', () => {
    it('throws when orderNumber is blank', () => {
      expect(() => PurchaseOrderInvariants.enforcePurchaseOrderCreate('', 'vendor-1')).toThrow(
        'Purchase order number is required',
      );
    });

    it('throws when vendorId is blank', () => {
      expect(() => PurchaseOrderInvariants.enforcePurchaseOrderCreate('PO-00000001', '')).toThrow(
        'Purchase order vendor is required',
      );
    });

    it('passes with valid order number and vendor', () => {
      expect(() =>
        PurchaseOrderInvariants.enforcePurchaseOrderCreate('PO-00000001', 'vendor-1'),
      ).not.toThrow();
    });
  });

  describe('enforcePurchaseOrderLineQuantity', () => {
    it('throws for zero', () => {
      expect(() => PurchaseOrderInvariants.enforcePurchaseOrderLineQuantity(0)).toThrow(
        'Line quantity must be a positive integer',
      );
    });

    it('throws for negative', () => {
      expect(() => PurchaseOrderInvariants.enforcePurchaseOrderLineQuantity(-1)).toThrow(
        'Line quantity must be a positive integer',
      );
    });

    it('throws for non-integer', () => {
      expect(() => PurchaseOrderInvariants.enforcePurchaseOrderLineQuantity(1.5)).toThrow(
        'Line quantity must be a positive integer',
      );
    });

    it('passes for positive integer', () => {
      expect(() => PurchaseOrderInvariants.enforcePurchaseOrderLineQuantity(10)).not.toThrow();
    });
  });

  describe('enforcePurchaseOrderHasLines', () => {
    it('throws when no lines', () => {
      expect(() => PurchaseOrderInvariants.enforcePurchaseOrderHasLines(0)).toThrow(
        'Purchase order must contain at least one line',
      );
    });

    it('passes with at least one line', () => {
      expect(() => PurchaseOrderInvariants.enforcePurchaseOrderHasLines(1)).not.toThrow();
    });
  });

  describe('enforcePurchaseOrderEditable', () => {
    it('throws when not DRAFT', () => {
      expect(() =>
        PurchaseOrderInvariants.enforcePurchaseOrderEditable(PurchaseOrderStatus.APPROVED),
      ).toThrow('only DRAFT orders are editable');
    });

    it('passes for DRAFT', () => {
      expect(() =>
        PurchaseOrderInvariants.enforcePurchaseOrderEditable(PurchaseOrderStatus.DRAFT),
      ).not.toThrow();
    });
  });

  describe('enforcePurchaseOrderAmendable', () => {
    it('throws when not ISSUED', () => {
      expect(() =>
        PurchaseOrderInvariants.enforcePurchaseOrderAmendable(PurchaseOrderStatus.DRAFT),
      ).toThrow('Only an issued purchase order can be amended');
    });

    it('passes for ISSUED', () => {
      expect(() =>
        PurchaseOrderInvariants.enforcePurchaseOrderAmendable(PurchaseOrderStatus.ISSUED),
      ).not.toThrow();
    });
  });

  describe('enforcePurchaseOrderStatusTransition', () => {
    it('allows DRAFT -> SUBMITTED', () => {
      expect(() =>
        PurchaseOrderInvariants.enforcePurchaseOrderStatusTransition(
          PurchaseOrderStatus.DRAFT,
          PurchaseOrderStatus.SUBMITTED,
        ),
      ).not.toThrow();
    });

    it('allows SUBMITTED -> APPROVED', () => {
      expect(() =>
        PurchaseOrderInvariants.enforcePurchaseOrderStatusTransition(
          PurchaseOrderStatus.SUBMITTED,
          PurchaseOrderStatus.APPROVED,
        ),
      ).not.toThrow();
    });

    it('allows SUBMITTED -> REJECTED', () => {
      expect(() =>
        PurchaseOrderInvariants.enforcePurchaseOrderStatusTransition(
          PurchaseOrderStatus.SUBMITTED,
          PurchaseOrderStatus.REJECTED,
        ),
      ).not.toThrow();
    });

    it('allows APPROVED -> ISSUED', () => {
      expect(() =>
        PurchaseOrderInvariants.enforcePurchaseOrderStatusTransition(
          PurchaseOrderStatus.APPROVED,
          PurchaseOrderStatus.ISSUED,
        ),
      ).not.toThrow();
    });

    it('rejects DRAFT -> APPROVED', () => {
      expect(() =>
        PurchaseOrderInvariants.enforcePurchaseOrderStatusTransition(
          PurchaseOrderStatus.DRAFT,
          PurchaseOrderStatus.APPROVED,
        ),
      ).toThrow('Invalid purchase order transition');
    });

    it('rejects REJECTED -> anything', () => {
      expect(() =>
        PurchaseOrderInvariants.enforcePurchaseOrderStatusTransition(
          PurchaseOrderStatus.REJECTED,
          PurchaseOrderStatus.CANCELLED,
        ),
      ).toThrow('Invalid purchase order transition');
    });

    it('allows no-op transition (status === to)', () => {
      expect(() =>
        PurchaseOrderInvariants.enforcePurchaseOrderStatusTransition(
          PurchaseOrderStatus.DRAFT,
          PurchaseOrderStatus.DRAFT,
        ),
      ).not.toThrow();
    });
  });
});
