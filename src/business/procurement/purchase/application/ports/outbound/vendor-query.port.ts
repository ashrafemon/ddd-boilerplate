/**
 * Outbound cross-module port consumed by PurchaseOrder. Typed against a local
 * structural reference shape. PurchaseOrder never imports the Vendor module —
 * the adapter resolves the vendor query use case through the ModuleRef and
 * delegates to it.
 */
export interface VendorReference {
  id: string;
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  status: string;
}

export abstract class OrderableVendorQueryPort {
  abstract getOrderableVendor(id: string): Promise<VendorReference | null>;
}
