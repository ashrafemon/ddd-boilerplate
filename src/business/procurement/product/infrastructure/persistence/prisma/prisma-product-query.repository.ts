import { ProductQuery } from '@business/procurement/product/application/queries/product.query';
import { PrismaReadPort } from '@platform/context/ports/prisma-read.port';
import { Injectable } from '@nestjs/common';
import { PageQuery, PageResult } from '@shared-kernel/types/pagination';
import { ProductQueryRecord } from '../../domain/types/product.types';
import { PrismaProductMapper } from './prisma-product.mapper';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { TenantScope } from '@shared-kernel/utils/tenant-scope.util';

@Injectable()
export class PrismaProductQueryRepository extends ProductQuery {
  constructor(
    private readonly prismaRead: PrismaReadPort,
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

  async findById(id: string): Promise<ProductQueryRecord | null> {
    const row = await this.prismaRead.product.findFirst({ where: { id, ...this.sharedScope() } });
    return row ? PrismaProductMapper.toRecord(row as never) : null;
  }

  async findBySku(sku: string): Promise<ProductQueryRecord | null> {
    const row = await this.prismaRead.product.findFirst({ where: { sku, ...this.sharedScope() } });
    return row ? PrismaProductMapper.toRecord(row as never) : null;
  }

  async findPurchasableById(id: string): Promise<ProductQueryRecord | null> {
    const row = await this.prismaRead.product.findFirst({
      where: { id, status: 'ACTIVE' as never, ...this.sharedScope() },
    });
    return row ? PrismaProductMapper.toRecord(row as never) : null;
  }

  async findPurchasableByIds(ids: string[]): Promise<ProductQueryRecord[]> {
    if (ids.length === 0) return [];
    const rows = await this.prismaRead.product.findMany({
      where: { id: { in: ids }, status: 'ACTIVE' as never, ...this.sharedScope() },
    });
    return rows.map((row: never) => PrismaProductMapper.toRecord(row));
  }

  async findPurchasableBySkus(skus: string[]): Promise<ProductQueryRecord[]> {
    if (skus.length === 0) return [];
    const rows = await this.prismaRead.product.findMany({
      where: { sku: { in: skus }, status: 'ACTIVE' as never, ...this.sharedScope() },
    });
    return rows.map((row: never) => PrismaProductMapper.toRecord(row));
  }

  async findAll(query: PageQuery): Promise<PageResult<ProductQueryRecord>> {
    const skip = (query.page - 1) * query.pageSize;
    const [rows, total] = await Promise.all([
      this.prismaRead.product.findMany({
        where: this.sharedScope(),
        skip,
        take: query.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prismaRead.product.count({ where: this.sharedScope() }),
    ]);
    return {
      items: rows.map((row: never) => PrismaProductMapper.toRecord(row)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }
}
