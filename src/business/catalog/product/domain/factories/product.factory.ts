import { DomainFactory } from '@business/shared-business/domain/factories/factory.base';
import { invariantRegistry } from '@business/shared-business/domain/invariants/invariant.registry';
import {
  Product,
  CreateProductInput,
  ProductProps,
  ProductStatus,
} from '../entities/product.aggregate';
import { ProductId } from '../value-objects/product-id.vo';
import { Sku } from '../value-objects/sku.vo';
import { ProductName } from '../value-objects/product-name.vo';
import { ProductCreated } from '../events/product.events';
import './../invariants/product.invariants';
import './../policies/product.policy';

/**
 * Product domain factory — the single entry point for creating and
 * rehydrating Product aggregates. Enforces creation invariants through the
 * invariant registry and raises the ProductCreated domain event.
 */
export class ProductFactory extends DomainFactory<Product, CreateProductInput> {
  create(input: CreateProductInput): Product {
    invariantRegistry.enforce('product.create', {
      sku: input.sku,
      name: input.name,
      unitPrice: input.unitPrice.amount,
    });

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

  reconstitute(id: ProductId, props: ProductProps, version: number): Product {
    return Product.instantiate(id, props, version);
  }
}

export const productFactory = new ProductFactory();
