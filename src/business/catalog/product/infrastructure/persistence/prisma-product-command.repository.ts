import { ProductCommandRepositoryPort } from '@business/catalog/product/domain/domain-ports';
import { Product } from '@business/catalog/product/domain/entities';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Injectable } from '@nestjs/common';
import { ProductMapper } from './product.mapper';

@Injectable()
export class PrismaProductCommandRepository extends ProductCommandRepositoryPort {
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
}
