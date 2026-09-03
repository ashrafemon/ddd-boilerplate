import { VendorReference } from '@business/party/vendor/public';

export abstract class OrderableVendorQueryPort {
  abstract getOrderableVendor(id: string): Promise<VendorReference | null>;
}
