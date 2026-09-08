import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Product } from '@business/catalog/product/domain/aggregates/product.aggregate';
import { ProductCommandRepository } from '@business/catalog/product/domain/repositories/product-command.repository';
import { ProductId } from '@business/catalog/product/domain/value-objects/product-id.vo';
import { ProductName } from '@business/catalog/product/domain/value-objects/product-name.vo';
import { Sku } from '@business/catalog/product/domain/value-objects/sku.vo';
import { Money } from '@business/shared-business/domain/common/value-objects/money';
import { ProductStatus } from '../../domain/types/product.enum';
import { ProductProps } from '../../domain/types/product.types';

@Injectable()
export class PrismaProductCommandRepository extends ProductCommandRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {
    super();
  }

  async findById(id: string): Promise<Product | null> {
    const row = await this.txHost.tx.product.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findBySku(sku: string): Promise<Product | null> {
    const row = await this.txHost.tx.product.findUnique({ where: { sku } });
    return row ? this.toDomain(row) : null;
  }

  async save(product: Product): Promise<Product> {
    await this.txHost.tx.product.create({ data: { ...this.toRow(product) } as never });
    return product;
  }

  async update(product: Product): Promise<Product> {
    await this.txHost.tx.product.update({
      where: { id: product.id.toString() },
      data: { ...this.toRow(product) } as never,
    });
    return product;
  }

  private toDomain(row: {
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

  private toRow(product: Product) {
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
