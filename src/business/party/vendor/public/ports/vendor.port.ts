import { VendorReference } from '../contracts/vendor.contracts';

export abstract class VendorQueryPort {
  abstract getOrderableVendor(id: string): Promise<VendorReference | null>;
}