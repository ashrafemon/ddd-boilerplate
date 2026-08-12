import { Inject, Injectable } from '@nestjs/common';
import {
  MODULE_PORT_RESOLVER,
  ModulePortResolver,
} from '@business/shared-business/ports/module-port-resolver.port';
import { GetPurchasableProductUseCase } from '@business/catalog/product/application/usecase/get-purchasable-product.usecase';
import {
  PurchasableProductQueryPort,
  ProductReference,
} from '../../ports/outbound/product-query.port';

/**
 * Adapter between PurchaseOrder's outbound port and the Product module's query
 * use case. Resolves the use case via the ModulePortResolver — no module
 * import. The adapter only calls the use case, never infrastructure services.
 */
@Injectable()
export class ProductQueryAdapter implements PurchasableProductQueryPort {
  constructor(@Inject(MODULE_PORT_RESOLVER) private readonly portResolver: ModulePortResolver) {}

  private get purchasableProductUseCase(): GetPurchasableProductUseCase {
    return this.portResolver.resolvePort<GetPurchasableProductUseCase>(
      GetPurchasableProductUseCase,
    );
  }

  async getPurchasableProduct(id: string): Promise<ProductReference | null> {
    return this.purchasableProductUseCase.execute(id);
  }
}
