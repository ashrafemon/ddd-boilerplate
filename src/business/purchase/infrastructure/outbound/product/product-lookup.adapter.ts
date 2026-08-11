import { Injectable } from '@nestjs/common';
import { ModulePortAccessor } from '../../../../../shared-kernel/ports/module-port-accessor';
import { GetProductPort } from '../../../../product/application/port/get-product.port';
import {
  ProductLookupInput,
  ProductLookupOutput,
  ProductLookupPort,
} from '../../../domain/port/product-lookup.port';

/**
 * Bridge from the Purchase bounded context to the Product bounded context.
 * Resolves the Product module's GetProductPort through ModulePortAccessor.
 */
@Injectable()
export class ProductLookupAdapter implements ProductLookupPort {
  constructor(private readonly portAccessor: ModulePortAccessor) {}

  public async findForPurchase(input: ProductLookupInput): Promise<ProductLookupOutput> {
    const productPort = this.portAccessor.resolve(GetProductPort);
    const product = await productPort.execute({ productId: input.productId });

    return {
      productId: product.id,
      code: product.code,
      sku: product.sku,
      name: product.name,
      unit: product.unit,
      status: product.status,
      isActive: product.status === 'ACTIVE',
      isPurchasable: product.isPurchasable,
      priceCents: product.priceCents,
      currency: product.currency,
    };
  }
}
