import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Product } from '@business/catalog/product/domain/entities/product.aggregate';
import { ProductId } from '@business/catalog/product/domain/value-objects/product-id.vo';
import { Sku } from '@business/catalog/product/domain/value-objects/sku.vo';
import { ProductCommandRepositoryPort } from '@business/catalog/product/ports/outbound/product-command-repository.port';
import { ProductMapper } from './product.mapper';

@Injectable()
export class PrismaProductCommandRepository implements ProductCommandRepositoryPort {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {}

  async save(product: Product): Promise<Product> {
    await this.txHost.tx.product.create({ data: { ...ProductMapper.toRow(product) } as never });
    return product;
  }

  async update(product: Product): Promise<Product> {
    await this.txHost.tx.product.update({
      where: { id: product.id.toString() },
      data: { ...ProductMapper.toRow(product) } as never,
    });
    return product;
  }

  async findById(id: ProductId): Promise<Product | null> {
    const row = await this.txHost.tx.product.findUnique({ where: { id: id.toString() } });
    return row ? ProductMapper.toDomain(row) : null;
  }

  async findBySku(sku: Sku): Promise<Product | null> {
    const row = await this.txHost.tx.product.findUnique({ where: { sku: sku.value } });
    return row ? ProductMapper.toDomain(row) : null;
  }
}
