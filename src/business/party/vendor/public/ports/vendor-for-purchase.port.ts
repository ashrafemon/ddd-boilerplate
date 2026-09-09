import { VendorReference } from '../contracts/vendor.contracts';

export abstract class VendorForPurchasePort {
  abstract getOrderableVendor(id: string): Promise<VendorReference | null>;
}
