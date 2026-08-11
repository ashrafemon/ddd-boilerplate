import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { AggregateNotFoundException } from '../../../../../shared-kernel/exceptions/aggregate-not-found.exception';
import { Product } from '../../../domain/aggregate/product/product.entity';
import { ProductId } from '../../../domain/aggregate/product/product-id.vo';
import { ProductPersistenceData, ProductWriteRepositoryPort } from '../../../domain/port/product-write-repository.port';
import { ProductBuilder } from '../../../domain/service/product-builder.service';
import { ProductMapper } from '../product.mapper';

type TxClient = Prisma.TransactionClient;

/**
 * Write-side persistence for the Product aggregate.
 *
 * The repository persists plain data (`ProductPersistenceData`) — it never
 * receives the aggregate. The domain is only used to enforce invariants and
 * record domain events.
 */
@Injectable()
export class PrismaProductWriteRepositoryAdapter implements ProductWriteRepositoryPort {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
    private readonly builder: ProductBuilder,
  ) {}

  public async save(data: ProductPersistenceData): Promise<void> {
    const client = this.getClient();

    if (data.operation === 'create') {
      await client.product.create({
        data: {
          id: data.id,
          tenantId: data.tenantId,
          organizationId: data.organizationId,
          code: data.code,
          name: data.name,
          description: data.description ?? null,
          sku: data.sku,
          unit: data.unit,
          status: data.status,
          isPurchasable: data.isPurchasable,
          isSellable: data.isSellable,
          priceCents: data.priceCents,
          currency: data.currency,
          categoryId: data.categoryId ?? null,
        },
      });
      return;
    }

    const existing = await client.product.findUnique({ where: { id: data.id } });
    if (!existing) {
      throw new AggregateNotFoundException('Product', data.id);
    }

    await client.product.update({
      where: { id: data.id },
      data: {
        code: data.code,
        name: data.name,
        description: data.description,
        sku: data.sku,
        unit: data.unit,
        status: data.status,
        isPurchasable: data.isPurchasable,
        isSellable: data.isSellable,
        priceCents: data.priceCents,
        currency: data.currency,
        categoryId: data.categoryId,
      },
    });
  }

  public async findById(id: ProductId): Promise<Product | null> {
    const row = await this.getClient().product.findUnique({ where: { id: id.getValue() } });
    if (!row) return null;
    return this.builder.reconstitute(ProductMapper.toSnapshot(row));
  }

  public async findByCode(
    tenantId: string,
    organizationId: string,
    code: string,
  ): Promise<Product | null> {
    const row = await this.getClient().product.findFirst({
      where: { tenantId, organizationId, code: code.trim().toUpperCase() },
    });
    if (!row) return null;
    return this.builder.reconstitute(ProductMapper.toSnapshot(row));
  }

  private getClient(): TxClient {
    return this.txHost.tx;
  }
}
