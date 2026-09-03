import { Product } from '@business/catalog/product/domain/aggregates/product.aggregate';
import { ProductCommandRepositoryPort } from '@business/catalog/product/domain/domain-ports/product-command-repository.port';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Injectable } from '@nestjs/common';
import { ProductMapper } from '../../application/mappers/product.mapper';

@Injectable()
export class PrismaProductCommandRepository extends ProductCommandRepositoryPort {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {
    super();
  }

  async findById(id: string): Promise<Product | null> {
    const row = await this.txHost.tx.product.findUnique({ where: { id } });
    return row ? ProductMapper.toDomain(row) : null;
  }

  async findBySku(sku: string): Promise<Product | null> {
    const row = await this.txHost.tx.product.findUnique({ where: { sku } });
    return row ? ProductMapper.toDomain(row) : null;
  }

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
}