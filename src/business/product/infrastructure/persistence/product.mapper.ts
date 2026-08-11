import { Prisma } from '@prisma/client';
import { Currency } from '../../../../shared-business/value-object/currency';
import { Money } from '../../../../shared-business/value-object/money';
import { OrganizationId } from '../../../../shared-business/value-object/organization-id';
import { Sku } from '../../../../shared-business/value-object/sku';
import { TenantId } from '../../../../shared-business/value-object/tenant-id';
import { ProductSnapshot } from '../../domain/aggregate/product/product.entity';
import { ProductId } from '../../domain/aggregate/product/product-id.vo';
import { ProductReadModel } from '../../domain/port/product-read-repository.port';
import { ProductStatus } from '../../domain/value-object/product-status.vo';
import { ProductUnit } from '../../domain/value-object/product-unit.vo';

type ProductRow = Prisma.ProductGetPayload<{}>;

/**
 * Maps between the Product domain aggregate and its persistence model.
 */
export class ProductMapper {
  public static toSnapshot(row: ProductRow): ProductSnapshot {
    return {
      id: ProductId.from(row.id),
      tenantId: TenantId.from(row.tenantId),
      organizationId: OrganizationId.from(row.organizationId),
      code: row.code,
      name: row.name,
      description: row.description ?? undefined,
      sku: Sku.from(row.sku),
      unit: ProductUnit.from(row.unit),
      status: ProductStatus.from(row.status),
      isPurchasable: row.isPurchasable,
      isSellable: row.isSellable,
      price: Money.from(row.priceCents, Currency.from(row.currency)),
      categoryId: row.categoryId ?? undefined,
    };
  }

  public static toReadModel(row: ProductRow): ProductReadModel {
    return {
      id: row.id,
      tenantId: row.tenantId,
      organizationId: row.organizationId,
      code: row.code,
      name: row.name,
      description: row.description,
      sku: row.sku,
      unit: row.unit,
      status: row.status,
      isPurchasable: row.isPurchasable,
      isSellable: row.isSellable,
      priceCents: row.priceCents,
      currency: row.currency,
      categoryId: row.categoryId,
    };
  }
}
