import { Inject, Injectable } from '@nestjs/common';
import {
  MODULE_PORT_RESOLVER,
  ModulePortResolver,
} from '@business/shared-business/ports/module-port-resolver.port';
import { GetOrderableVendorUseCase } from '@business/supplier/vendor/application/usecase/get-orderable-vendor.usecase';
import { OrderableVendorQueryPort, VendorReference } from '../../ports/outbound/vendor-query.port';

/**
 * Adapter between PurchaseOrder's outbound port and the Vendor module's query
 * use case. Resolves the use case via the ModulePortResolver — no module
 * import. The adapter only calls the use case, never infrastructure services.
 */
@Injectable()
export class VendorQueryAdapter implements OrderableVendorQueryPort {
  constructor(@Inject(MODULE_PORT_RESOLVER) private readonly portResolver: ModulePortResolver) {}

  private get orderableVendorUseCase(): GetOrderableVendorUseCase {
    return this.portResolver.resolvePort<GetOrderableVendorUseCase>(GetOrderableVendorUseCase);
  }

  async getOrderableVendor(id: string): Promise<VendorReference | null> {
    return this.orderableVendorUseCase.execute(id);
  }
}
