import { PurchaseApprovalPolicy } from '../../src/business/purchase/domain/policy/purchase-approval.policy';
import { PurchaseLimitPolicy } from '../../src/business/purchase/domain/policy/purchase-limit.policy';
import { ProductPurchasabilityPolicy } from '../../src/business/purchase/domain/policy/product-purchasability.policy';
import { VendorSelectionPolicy } from '../../src/business/purchase/domain/policy/vendor-selection.policy';
import { PolicyViolationException } from '../../src/shared-kernel/exceptions/policy-violation.exception';

describe('Purchase policies', () => {
  describe('PurchaseApprovalPolicy', () => {
    const policy = new PurchaseApprovalPolicy();

    it('allows approval within limits with an active vendor', () => {
      const result = policy.evaluate({
        purchaseOrderId: 'po-1',
        totalCents: 1000,
        currency: 'USD',
        vendorActive: true,
        approvalLimitCents: 10000,
        requiresAdditionalApprovalLimitCents: 50000,
      });
      expect(result.isAllowed).toBe(true);
      expect(result.requiresAdditionalApproval).toBe(false);
    });

    it('rejects approval for inactive vendors', () => {
      const result = policy.evaluate({
        purchaseOrderId: 'po-1',
        totalCents: 1000,
        currency: 'USD',
        vendorActive: false,
        approvalLimitCents: 10000,
      });
      expect(result.isAllowed).toBe(false);
    });

    it('flags orders above the limit as requiring additional approval', () => {
      const result = policy.evaluate({
        purchaseOrderId: 'po-1',
        totalCents: 20000,
        currency: 'USD',
        vendorActive: true,
        approvalLimitCents: 10000,
        requiresAdditionalApprovalLimitCents: 50000,
      });
      expect(result.requiresAdditionalApproval).toBe(true);
      expect(result.isAllowed).toBe(false);
    });

    it('enforces via the policy contract', () => {
      const policy2 = new PurchaseLimitPolicy();
      expect(() =>
        policy2.enforce({ totalCents: 5000, currency: 'USD', limitCents: 1000 }),
      ).toThrow(PolicyViolationException);
    });
  });

  describe('ProductPurchasabilityPolicy', () => {
    const policy = new ProductPurchasabilityPolicy();

    it('rejects inactive or non-purchasable products', () => {
      expect(
        policy.can({ productId: 'p1', sku: 'A', productActive: false, isPurchasable: true }),
      ).toBe(false);
      expect(
        policy.can({ productId: 'p1', sku: 'A', productActive: true, isPurchasable: false }),
      ).toBe(false);
      expect(
        policy.can({ productId: 'p1', sku: 'A', productActive: true, isPurchasable: true }),
      ).toBe(true);
    });
  });

  describe('VendorSelectionPolicy', () => {
    const policy = new VendorSelectionPolicy();

    it('only selects active vendors', () => {
      expect(policy.can({ vendorId: 'v1', vendorActive: true })).toBe(true);
      expect(policy.can({ vendorId: 'v1', vendorActive: false })).toBe(false);
    });
  });
});
