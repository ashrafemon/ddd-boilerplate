import { VendorReference } from '../contracts/vendor-for-purchase.contract';

export abstract class VendorForPurchasePort {
  abstract getOrderableVendor(id: string): Promise<VendorReference | null>;
  /** Batch lookup by vendor code (stored upper-case); unknown/non-orderable codes are absent. */
  abstract findOrderableVendorsByCodes(codes: string[]): Promise<VendorReference[]>;
}
