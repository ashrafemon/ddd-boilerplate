import { VendorReference } from '@business/party/vendor/public';

export abstract class OrderableVendorPort {
  abstract getOrderableVendor(id: string): Promise<VendorReference | null>;
}
