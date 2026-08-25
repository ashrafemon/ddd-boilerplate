import { ProductId, ProductName, Sku } from '@business/catalog/product/domain/value-objects';
import { Money } from '@business/shared-business/domain/common/value-objects/money';
import { Product } from '../../domain/aggregates';
import { ProductStatus } from '../../domain/types/product.enum';
import { ProductProps } from '../../domain/types/product.types';

interface ProductRow {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  status: string;
  unitPrice: unknown;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export class ProductMapper {
  static toDomain(row: ProductRow): Product {
    return Product.instantiate(
      ProductId.fromString(row.id),
      {
        sku: Sku.create(row.sku),
        name: ProductName.create(row.name),
        description: row.description,
        status: row.status as ProductStatus,
        unitPrice: Money.fromDecimal(Number(row.unitPrice), row.currency),
        currency: row.currency,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      } satisfies ProductProps,
      row.version,
    );
  }

  static toRow(product: Product) {
    return {
      id: product.id.toString(),
      sku: product.sku,
      name: product.name,
      description: product.description,
      status: product.status,
      unitPrice: product.unitPrice.toDecimal(),
      currency: product.currency,
      version: product.getVersion(),
    };
  }
}
