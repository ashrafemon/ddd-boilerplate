import { ApprovalPolicy } from './approval.policy';
import { PurchaseOrderStatus } from '../types/purchase-order.enum';

describe('ApprovalPolicy', () => {
  describe('enforcePurchaseOrderApproval', () => {
    it('passes when status is not SUBMITTED (no-op)', () => {
      expect(() =>
        ApprovalPolicy.enforcePurchaseOrderApproval(PurchaseOrderStatus.DRAFT, 100, 50),
      ).not.toThrow();
    });

    it('passes when SUBMITTED and total <= threshold', () => {
      expect(() =>
        ApprovalPolicy.enforcePurchaseOrderApproval(PurchaseOrderStatus.SUBMITTED, 50, 100),
      ).not.toThrow();
    });

    it('passes when SUBMITTED and total === threshold', () => {
      expect(() =>
        ApprovalPolicy.enforcePurchaseOrderApproval(PurchaseOrderStatus.SUBMITTED, 100, 100),
      ).not.toThrow();
    });

    it('throws when SUBMITTED and total > threshold', () => {
      expect(() =>
        ApprovalPolicy.enforcePurchaseOrderApproval(PurchaseOrderStatus.SUBMITTED, 101, 100),
      ).toThrow('Purchase order requires approval');
    });
  });
});
