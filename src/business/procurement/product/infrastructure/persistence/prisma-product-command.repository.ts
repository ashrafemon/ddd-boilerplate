import { ConflictException, Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Product } from '@business/procurement/product/domain/aggregates/product.aggregate';
import { ProductCommandRepository } from '@business/procurement/product/domain/repositories/product-command.repository';
import { PrismaProductMapper } from './prisma-product.mapper';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { TenantScope } from '@shared-kernel/utils/tenant-scope.util';

@Injectable()
export class PrismaProductCommandRepository extends ProductCommandRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
    private readonly requestContext: RequestContextPort,
  ) {
    super();
  }

  /**
   * Master data is SHARED: a tenant-scoped request sees its own rows plus rows
   * that were never tenant-scoped (NULL = the shared catalogue). A row owned
   * by another tenant is invisible.
   */
  private sharedScope(): { OR: Array<{ tenantId: string | null }> } {
    return TenantScope.where<{ OR: Array<{ tenantId: string | null }> }>(
      this.requestContext.getTenantId(),
      { includeUnscoped: true },
    );
  }

  async findById(id: string): Promise<Product | null> {
    const row = await this.txHost.tx.product.findFirst({
      where: { id, ...this.sharedScope() },
    });
    return row ? PrismaProductMapper.toDomain(row) : null;
  }

  async findBySku(sku: string): Promise<Product | null> {
    const row = await this.txHost.tx.product.findFirst({
      where: { sku, ...this.sharedScope() },
    });
    return row ? PrismaProductMapper.toDomain(row) : null;
  }

  async save(product: Product): Promise<Product> {
    await this.txHost.tx.product.create({
      data: {
        ...PrismaProductMapper.toRow(product),
        tenantId: this.requestContext.getTenantId(),
        companyId: this.requestContext.getCompanyId(),
      } as never,
    });
    return product;
  }

  async update(product: Product): Promise<Product> {
    // Scoped write: `updateMany` (not `update`) so the tenant predicate can
    // join the WHERE clause. Zero rows ⇒ the row is gone or belongs to another
    // tenant — the use case already 404s a foreign row on its scoped read.
    const res = await this.txHost.tx.product.updateMany({
      where: { id: product.id.toString(), ...this.sharedScope() },
      data: { ...PrismaProductMapper.toRow(product) } as never,
    });
    if (res.count === 0) {
      throw new ConflictException('Product was modified concurrently (not found in scope)');
    }
    return product;
  }
}
