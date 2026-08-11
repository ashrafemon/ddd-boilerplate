import { Policy } from '../../../../shared-business/policy/policy';

export interface PurchaseApprovalContext {
  purchaseOrderId: string;
  totalCents: number;
  currency: string;
  vendorActive: boolean;
  approvalLimitCents?: number;
  requiresAdditionalApprovalLimitCents?: number;
}

export interface PurchaseApprovalDecision {
  isAllowed: boolean;
  requiresAdditionalApproval: boolean;
  reasons: string[];
}

/**
 * Decides whether a purchase order can be approved:
 *   - the vendor must be active,
 *   - if the total exceeds the configured limit the order is not directly
 *     approvable and requires an additional approval level.
 */
export class PurchaseApprovalPolicy extends Policy<PurchaseApprovalContext> {
  public readonly name = 'purchase-approval';

  public evaluate(context: PurchaseApprovalContext): PurchaseApprovalDecision {
    const reasons: string[] = [];

    if (!context.vendorActive) {
      reasons.push('The vendor is not active');
    }

    const limit = context.approvalLimitCents;
    const additionalLimit = context.requiresAdditionalApprovalLimitCents;

    if (additionalLimit !== undefined && context.totalCents > additionalLimit) {
      reasons.push(
        `Purchase order total ${centsToText(context)} exceeds the additional approval limit ${centsText(additionalLimit, context.currency)}`,
      );
    }

    const overLimit = limit !== undefined && context.totalCents > limit;

    return {
      isAllowed: reasons.length === 0 && !overLimit,
      requiresAdditionalApproval: overLimit,
      reasons,
    };
  }
}

function centsText(cents: number, currency: string): string {
  return `${(cents / 100).toFixed(2)} ${currency}`;
}

function centsToText(context: PurchaseApprovalContext): string {
  return centsText(context.totalCents, context.currency);
}
