import { CanApprovePolicy } from './can-approve.policy';
import { PurchaseOrderStatus } from '../types/purchase-order.enum';

describe('CanApprovePolicy', () => {
  describe('enforcePurchaseOrderCanApprove', () => {
    it('returns true when status is not SUBMITTED (no-op)', () => {
      expect(
        CanApprovePolicy.enforcePurchaseOrderCanApprove(PurchaseOrderStatus.DRAFT, 100, 50),
      ).toBe(true);
    });

    it('returns true when SUBMITTED and total <= threshold', () => {
      expect(
        CanApprovePolicy.enforcePurchaseOrderCanApprove(PurchaseOrderStatus.SUBMITTED, 50, 100),
      ).toBe(true);
    });

    it('returns true when SUBMITTED and total === threshold', () => {
      expect(
        CanApprovePolicy.enforcePurchaseOrderCanApprove(PurchaseOrderStatus.SUBMITTED, 100, 100),
      ).toBe(true);
    });

    it('returns false when SUBMITTED and total > threshold', () => {
      expect(
        CanApprovePolicy.enforcePurchaseOrderCanApprove(PurchaseOrderStatus.SUBMITTED, 101, 100),
      ).toBe(false);
    });
  });
});
