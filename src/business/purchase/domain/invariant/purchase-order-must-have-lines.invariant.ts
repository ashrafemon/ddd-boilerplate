import { Invariant } from '../../../../shared-business/invariant/invariant';

export interface PurchaseOrderLinesContext {
  lineCount: number;
}

/**
 * A purchase order must always have at least one line (required for submit).
 */
export class PurchaseOrderMustHaveLinesInvariant extends Invariant {
  public readonly name = 'purchase-order-must-have-lines';

  public check(context: PurchaseOrderLinesContext): { isValid: boolean; messages: string[] } {
    if (context.lineCount === 0) {
      return {
        isValid: false,
        messages: ['Purchase order must contain at least one line'],
      };
    }
    return { isValid: true, messages: [] };
  }
}
