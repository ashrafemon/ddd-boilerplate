import { Product } from '../aggregates/product.aggregate';
import { CreateProductInput, ProductProps, ProductStatus } from '../types/product.types';
import { ProductId } from '../value-objects/product-id.vo';
import { Sku } from '../value-objects/sku.vo';
import { ProductName } from '../value-objects/product-name.vo';
import { ProductCreated } from '../events/product.created.event';
import { ProductInvariants } from '../aggregates/product.invariants';
import { SkuInvariants } from '../value-objects/sku.invariants';
import { ProductNameInvariants } from '../value-objects/product-name.invariants';

export class ProductFactory {
  static create(input: CreateProductInput): Product {
    ProductInvariants.enforceProductCreate(input.unitPrice.amount);
    SkuInvariants.enforceSkuFormat(input.sku);
    ProductNameInvariants.enforceProductName(input.name);

    const now = new Date();
    const currency = input.currency ?? 'USD';
    const product = Product.instantiate(
      ProductId.generate(),
      {
        sku: Sku.create(input.sku),
        name: ProductName.create(input.name),
        description: input.description?.trim() || null,
        status: ProductStatus.ACTIVE,
        unitPrice: input.unitPrice,
        currency,
        createdAt: now,
        updatedAt: now,
      },
      1,
    );

    product.addEvent(
      new ProductCreated(
        product.id,
        product.sku,
        product.name,
        product.unitPrice,
        product.currency,
      ),
    );
    return product;
  }

  static reconstitute(id: ProductId, props: ProductProps, version: number): Product {
    return Product.instantiate(id, props, version);
  }
}
