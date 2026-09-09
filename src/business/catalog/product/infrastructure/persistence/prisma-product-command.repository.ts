import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Product } from '@business/catalog/product/domain/aggregates/product.aggregate';
import { ProductCommandRepository } from '@business/catalog/product/domain/repositories/product-command.repository';
import { ProductId } from '@business/catalog/product/domain/value-objects/product-id.vo';
import { ProductName } from '@business/catalog/product/domain/value-objects/product-name.vo';
import { Sku } from '@business/catalog/product/domain/value-objects/sku.vo';
import { PrismaProductCommandMapper } from './prisma-product.mapper';

@Injectable()
export class PrismaProductCommandRepository extends ProductCommandRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {
    super();
  }

  async findById(id: string): Promise<Product | null> {
    const row = await this.txHost.tx.product.findUnique({ where: { id } });
    return row ? PrismaProductCommandMapper.toDomain(row) : null;
  }

  async findBySku(sku: string): Promise<Product | null> {
    const row = await this.txHost.tx.product.findUnique({ where: { sku } });
    return row ? PrismaProductCommandMapper.toDomain(row) : null;
  }

  async save(product: Product): Promise<Product> {
    await this.txHost.tx.product.create({ data: { ...PrismaProductCommandMapper.toRow(product) } as never });
    return product;
  }

  async update(product: Product): Promise<Product> {
    await this.txHost.tx.product.update({
      where: { id: product.id.toString() },
      data: { ...PrismaProductCommandMapper.toRow(product) } as never,
    });
    return product;
  }
}
