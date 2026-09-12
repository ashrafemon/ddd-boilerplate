import { ProductQuery } from '@business/procurement/product/application/queries/product.query';
import { PrismaReadPort } from '@platform/database/ports/prisma-read.port';
import { Injectable } from '@nestjs/common';
import { PageQuery, PageResult } from '@shared-kernel/types/pagination';
import { ProductQueryRecord } from '../../domain/types/product.types';
import { PrismaProductMapper } from './prisma-product.mapper';

@Injectable()
export class PrismaProductQueryRepository extends ProductQuery {
  constructor(private readonly prismaRead: PrismaReadPort) {
    super();
  }

  async findById(id: string): Promise<ProductQueryRecord | null> {
    const row = await this.prismaRead.product.findUnique({ where: { id } });
    return row ? PrismaProductMapper.toRecord(row as never) : null;
  }

  async findBySku(sku: string): Promise<ProductQueryRecord | null> {
    const row = await this.prismaRead.product.findUnique({ where: { sku } });
    return row ? PrismaProductMapper.toRecord(row as never) : null;
  }

  async findPurchasableById(id: string): Promise<ProductQueryRecord | null> {
    const row = await this.prismaRead.product.findFirst({
      where: { id, status: 'ACTIVE' as never },
    });
    return row ? PrismaProductMapper.toRecord(row as never) : null;
  }

  async findPurchasableByIds(ids: string[]): Promise<ProductQueryRecord[]> {
    if (ids.length === 0) return [];
    const rows = await this.prismaRead.product.findMany({
      where: { id: { in: ids }, status: 'ACTIVE' as never },
    });
    return rows.map((row: never) => PrismaProductMapper.toRecord(row));
  }

  async findAll(query: PageQuery): Promise<PageResult<ProductQueryRecord>> {
    const skip = (query.page - 1) * query.pageSize;
    const [rows, total] = await Promise.all([
      this.prismaRead.product.findMany({
        skip,
        take: query.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prismaRead.product.count(),
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
