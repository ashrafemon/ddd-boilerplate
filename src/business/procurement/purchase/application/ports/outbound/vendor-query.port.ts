import { VendorReference } from '../../domain/types/purchase-order.types';

export abstract class OrderableVendorQueryPort {
  abstract getOrderableVendor(id: string): Promise<VendorReference | null>;
}
