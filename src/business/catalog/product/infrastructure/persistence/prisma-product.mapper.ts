import { Product } from '@business/catalog/product/domain/aggregates/product.aggregate';
import { ProductId } from '@business/catalog/product/domain/value-objects/product-id.vo';
import { ProductName } from '@business/catalog/product/domain/value-objects/product-name.vo';
import { Sku } from '@business/catalog/product/domain/value-objects/sku.vo';
import { Money } from '@business/shared-business/domain/common/value-objects/money';
import { ProductQueryRecord } from '../../domain/types/product.types';
import { ProductStatus } from '../../domain/types/product.enum';
import { ProductProps } from '../../domain/types/product.types';

export class PrismaProductCommandMapper {
  static toDomain(row: {
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
  }): Product {
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

export class PrismaProductQueryMapper {
  static toRecord(row: never): ProductQueryRecord {
    const r = row as {
      id: string;
      sku: string;
      name: string;
      description: string | null;
      status: string;
      unitPrice: { toString(): string };
      currency: string;
      createdAt: Date;
      updatedAt: Date;
    };
    return {
      id: r.id,
      sku: r.sku,
      name: r.name,
      description: r.description,
      status: r.status,
      unitPrice: Number(r.unitPrice.toString()),
      currency: r.currency,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
}
