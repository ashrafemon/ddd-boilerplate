import { Injectable } from '@nestjs/common';
import { OrderableVendorPort } from '@business/procurement/purchase-order/application/outbound-ports/vendor-query.port';
import { VendorForPurchasePort, VendorReference } from '@business/party/vendor/public';

/**
 * Infrastructure adapter that implements PurchaseOrder's OrderableVendorPort
 * by delegating to Vendor module's public VendorForPurchasePort facade.
 */
@Injectable()
export class OrderableVendorAdapter implements OrderableVendorPort {
  constructor(private readonly vendorForPurchasePort: VendorForPurchasePort) {}

  getOrderableVendor(id: string): Promise<VendorReference | null> {
    return this.vendorForPurchasePort.getOrderableVendor(id);
  }
}
