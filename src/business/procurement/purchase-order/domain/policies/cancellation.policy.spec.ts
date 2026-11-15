import { CancellationPolicy } from './cancellation.policy';
import { PurchaseOrderStatus } from '../types/purchase-order.enum';

describe('CancellationPolicy', () => {
  describe('enforcePurchaseOrderCancellation', () => {
    it('passes when no receipts', () => {
      expect(() =>
        CancellationPolicy.enforcePurchaseOrderCancellation(PurchaseOrderStatus.APPROVED, false),
      ).not.toThrow();
    });

    it('throws when has receipts', () => {
      expect(() =>
        CancellationPolicy.enforcePurchaseOrderCancellation(PurchaseOrderStatus.APPROVED, true),
      ).toThrow('Cannot cancel a purchase order with posted receipts');
    });
  });
});
