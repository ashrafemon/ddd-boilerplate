export interface VendorLookupInput {
  vendorId: string;
}

export interface VendorLookupOutput {
  vendorId: string;
  code: string;
  name: string;
  status: string;
  isActive: boolean;
}

/**
 * Purchase-owned domain port: the Purchase bounded context needs vendor data
 * to build and approve purchase orders. The Vendor bounded context satisfies
 * this need by exposing its GetVendorPort; the bridge is implemented by a
 * purchase infrastructure adapter using ModulePortAccessor.
 */
export abstract class VendorLookupPort {
  public abstract findForPurchase(input: VendorLookupInput): Promise<VendorLookupOutput>;
}
