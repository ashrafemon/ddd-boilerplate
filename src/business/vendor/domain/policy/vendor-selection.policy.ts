import { OrganizationId } from '../../../../shared-business/value-object/organization-id';
import { Policy } from '../../../../shared-business/policy/policy';

export interface VendorSelectionContext {
  vendorStatus: 'ACTIVE' | 'INACTIVE';
  vendorId: string;
  organizationId: OrganizationId;
}

/**
 * Determines whether a vendor may be used by an organization (e.g. when a
 * purchase order is created against it). Only active vendors are selectable.
 */
export class VendorSelectionPolicy extends Policy<VendorSelectionContext> {
  public readonly name = 'vendor-selection';

  public evaluate(context: VendorSelectionContext): { isAllowed: boolean; reasons: string[] } {
    if (context.vendorStatus !== 'ACTIVE') {
      return {
        isAllowed: false,
        reasons: [`Vendor ${context.vendorId} is not active`],
      };
    }
    return { isAllowed: true, reasons: [] };
  }
}
