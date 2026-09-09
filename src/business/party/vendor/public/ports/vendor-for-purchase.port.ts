import { VendorReference } from '../contracts/vendor-for-purchase.contract';

export abstract class VendorForPurchasePort {
  abstract getOrderableVendor(id: string): Promise<VendorReference | null>;
}
