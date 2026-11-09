import { Injectable } from '@nestjs/common';
import { GetProductUseCase } from '../use-cases/get-product.usecase';
import { ProductForSalesPort } from '@business/product-management/product/public/ports/product-for-sales.port';
import { ProductReference } from '@business/product-management/product/public/contracts/product-for-sales.contract';

/**
 * Product module's sales facade exposed to Sales module. Adapts product data
 * to the sales contract.
 */
@Injectable()
export class ProductForSalesFacade extends ProductForSalesPort {
  constructor(private readonly getProductUseCase: GetProductUseCase) {
    super();
  }

  async getProductForSales(id: string): Promise<ProductReference | null> {
    const product = await this.getProductUseCase.execute(id);
    if (!product) return null;
    return {
      id: product.id,
      sku: product.sku,
      name: product.name,
      status: product.status,
      companyId: '',
      tenantId: null,
    };
  }
}
