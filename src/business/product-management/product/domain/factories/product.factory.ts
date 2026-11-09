import { invariantRegistry } from '@business/shared-business/domain/registries/invariant.registry';
import { Product } from '../aggregates/product.aggregate';
import { CreateProductInput, ProductProps, ProductStatus } from '../types/product.types';
import { ProductId } from '../value-objects/product-id.vo';
import { Sku } from '../value-objects/sku.vo';
import { ProductName } from '../value-objects/product-name.vo';
import { ProductCreated } from '../events/product.created.event';
import '../aggregates/product.invariants';
import '../value-objects/sku.invariants';
import '../value-objects/product-name.invariants';
import '../policies/reactivation.policy';

export class ProductFactory {
  static create(input: CreateProductInput): Product {
    invariantRegistry.enforce('product.create', {
      sku: input.sku,
      name: input.name,
      unitPrice: input.unitPrice.amount,
    });

    invariantRegistry.enforce('sku.create', { sku: input.sku });
    invariantRegistry.enforce('product-name.create', { name: input.name });

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
