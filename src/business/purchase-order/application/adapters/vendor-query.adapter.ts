import { Inject, Injectable } from '@nestjs/common';
import {
  VendorQueryPort,
  VENDOR_QUERY_PORT,
} from '@business/vendor/ports/inbound/vendor.query.port';
import { VendorId } from '@business/vendor/domain/value-objects/vendor-id.vo';
import { OrderableVendorQueryPort, VendorReference } from '../../ports/outbound/vendor-query.port';

/**
 * Adapter between PurchaseOrder's outbound port and the Vendor module's
 * inbound port. Ensures PurchaseOrder depends only on its own port contract
 * while the actual lookup is performed by the Vendor application service.
 */
@Injectable()
export class VendorQueryAdapter implements OrderableVendorQueryPort {
  constructor(@Inject(VENDOR_QUERY_PORT) private readonly vendorQueryPort: VendorQueryPort) {}

  async getOrderableVendor(id: string): Promise<VendorReference | null> {
    return this.vendorQueryPort.getOrderableVendor(VendorId.fromString(id));
  }
}
