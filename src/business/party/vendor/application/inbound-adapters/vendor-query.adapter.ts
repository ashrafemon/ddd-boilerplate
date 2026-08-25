import { Injectable } from '@nestjs/common';
import { GetOrderableVendorUseCase } from '../usecase';
import { OrderableVendorQueryPort, VendorReference } from '@business/procurement/purchase';

/**
 * Vendor module's implementation of PurchaseOrder's outbound contract. Lives
 * in the Vendor module because it adapts the vendor use case to the consuming
 * module's port — the adapter only calls its own use case, never
 * infrastructure services.
 */
@Injectable()
export class VendorQueryAdapter extends OrderableVendorQueryPort {
  constructor(private readonly getOrderableVendorUseCase: GetOrderableVendorUseCase) {
    super();
  }

  getOrderableVendor(id: string): Promise<VendorReference | null> {
    return this.getOrderableVendorUseCase.execute(id);
  }
}
