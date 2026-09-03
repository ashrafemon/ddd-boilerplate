import { VendorReference } from '@business/party/vendor/public/contracts/vendor.contracts';

export abstract class OrderableVendorQueryPort {
  abstract getOrderableVendor(id: string): Promise<VendorReference | null>;
}
