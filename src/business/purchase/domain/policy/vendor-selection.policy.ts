import { Policy } from '../../../../shared-business/policy/policy';

export interface VendorSelectionContext {
  vendorId: string;
  vendorActive: boolean;
}

/**
 * The vendor referenced by a purchase order must be active for the
 * organization.
 */
export class VendorSelectionPolicy extends Policy<VendorSelectionContext> {
  public readonly name = 'vendor-selection';

  public evaluate(context: VendorSelectionContext): { isAllowed: boolean; reasons: string[] } {
    if (!context.vendorActive) {
      return {
        isAllowed: false,
        reasons: [`Vendor ${context.vendorId} is not active`],
      };
    }
    return { isAllowed: true, reasons: [] };
  }
}
