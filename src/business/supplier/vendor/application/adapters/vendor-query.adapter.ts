import { Injectable } from '@nestjs/common';
import { GetOrderableVendorUseCase } from '../usecase/get-orderable-vendor.usecase';
import {
  OrderableVendorQueryPort,
  VendorReference,
} from '@business/procurement/purchase/application/ports/outbound/vendor-query.port';

/**
 * Vendor module's implementation of PurchaseOrder's outbound contract. Lives
 * in the Vendor module because it adapts the vendor use case to the consuming
 * module's port — the adapter only calls its own use case, never
 * infrastructure services.
 */
@Injectable()
export class VendorQueryAdapter implements OrderableVendorQueryPort {
  constructor(private readonly getOrderableVendorUseCase: GetOrderableVendorUseCase) {}

  getOrderableVendor(id: string): Promise<VendorReference | null> {
    return this.getOrderableVendorUseCase.execute(id);
  }
}
