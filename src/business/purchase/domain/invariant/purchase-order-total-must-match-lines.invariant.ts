import { Invariant } from '../../../../shared-business/invariant/invariant';

export interface PurchaseOrderTotalContext {
  totalCents: number;
  lineTotalsCents: number[];
}

/**
 * The aggregate total must equal the sum of its line totals. Money arithmetic
 * happens in the aggregate; this invariant guards against drift.
 */
export class PurchaseOrderTotalMustMatchLinesInvariant extends Invariant {
  public readonly name = 'purchase-order-total-must-match-lines';

  public check(context: PurchaseOrderTotalContext): { isValid: boolean; messages: string[] } {
    const computed = context.lineTotalsCents.reduce((sum, cents) => sum + cents, 0);
    if (computed !== context.totalCents) {
      return {
        isValid: false,
        messages: [
          `Purchase order total (${context.totalCents}) does not match the sum of its lines (${computed})`,
        ],
      };
    }
    return { isValid: true, messages: [] };
  }
}
