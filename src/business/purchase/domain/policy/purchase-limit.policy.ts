import { Policy } from '../../../../shared-business/policy/policy';

export interface PurchaseLimitContext {
  totalCents: number;
  currency: string;
  limitCents: number;
}

/**
 * Simple limit check used by organization-level purchase policies.
 */
export class PurchaseLimitPolicy extends Policy<PurchaseLimitContext> {
  public readonly name = 'purchase-limit';

  public evaluate(context: PurchaseLimitContext): { isAllowed: boolean; reasons: string[] } {
    if (context.totalCents > context.limitCents) {
      return {
        isAllowed: false,
        reasons: [
          `Purchase total ${(context.totalCents / 100).toFixed(2)} ${context.currency} exceeds the limit ${(context.limitCents / 100).toFixed(2)} ${context.currency}`,
        ],
      };
    }
    return { isAllowed: true, reasons: [] };
  }
}
