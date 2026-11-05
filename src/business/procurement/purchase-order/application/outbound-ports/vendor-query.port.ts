import { VendorReference } from '@business/party/vendor/public/contracts/vendor-for-purchase.contract';

export abstract class OrderableVendorPort {
  abstract getOrderableVendor(id: string): Promise<VendorReference | null>;
  abstract findOrderableVendorsByCodes(codes: string[]): Promise<VendorReference[]>;
}
