import { Injectable } from '@nestjs/common';
import { Money } from '../../../../shared-business/value-object/money';
import { OrganizationId } from '../../../../shared-business/value-object/organization-id';
import { Sku } from '../../../../shared-business/value-object/sku';
import { TenantId } from '../../../../shared-business/value-object/tenant-id';
import { createUuid } from '../../../../shared-kernel/utilities/uuid';
import { Currency } from '../../../../shared-business/value-object/currency';
import { Product, ProductSnapshot } from '../aggregate/product/product.entity';
import { ProductId } from '../aggregate/product/product-id.vo';
import { ProductUnit } from '../value-object/product-unit.vo';

export interface CreateProductData {
  id?: ProductId;
  tenantId: TenantId;
  organizationId: OrganizationId;
  code: string;
  name: string;
  description?: string;
  sku: string;
  unit: string;
  priceCents: number;
  currency: string;
  isPurchasable?: boolean;
  isSellable?: boolean;
  categoryId?: string;
}

/**
 * Domain builder for the Product aggregate.
 */
@Injectable()
export class ProductBuilder {
  public create(data: CreateProductData): Product {
    const product = Product.create({
      id: data.id ?? ProductId.from(createUuid()),
      tenantId: data.tenantId,
      organizationId: data.organizationId,
      code: data.code.trim().toUpperCase(),
      name: data.name.trim(),
      description: data.description,
      sku: Sku.from(data.sku),
      unit: ProductUnit.from(data.unit),
      price: Money.from(data.priceCents, Currency.from(data.currency)),
      isPurchasable: data.isPurchasable,
      isSellable: data.isSellable,
      categoryId: data.categoryId,
    });

    product.markCreated();
    return product;
  }

  public reconstitute(snapshot: ProductSnapshot): Product {
    return Product.reconstitute(snapshot);
  }
}
