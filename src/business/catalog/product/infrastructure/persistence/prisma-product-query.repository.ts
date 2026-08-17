import { Injectable } from '@nestjs/common';
import { PrismaReadService } from '@infrastructure/database/prisma/prisma-read.service';
import { PageQuery, PageResult } from '@shared-kernel/types/pagination';
import {
  ProductQueryRecord,
  ProductQueryRepositoryPort,
} from '@business/catalog/product/domain/domain-ports';

@Injectable()
export class PrismaProductQueryRepository extends ProductQueryRepositoryPort {
  constructor(private readonly prismaRead: PrismaReadService) {}

  async findById(id: string): Promise<ProductQueryRecord | null> {
    const row = await this.prismaRead.product.findUnique({ where: { id } });
    return row ? this.toRecord(row as never) : null;
  }

  async findBySku(sku: string): Promise<ProductQueryRecord | null> {
    const row = await this.prismaRead.product.findUnique({ where: { sku } });
    return row ? this.toRecord(row as never) : null;
  }

  async findPurchasableById(id: string): Promise<ProductQueryRecord | null> {
    const row = await this.prismaRead.product.findFirst({
      where: { id, status: 'ACTIVE' as never },
    });
    return row ? this.toRecord(row as never) : null;
  }

  async findPurchasableByIds(ids: string[]): Promise<ProductQueryRecord[]> {
    if (ids.length === 0) return [];
    const rows = await this.prismaRead.product.findMany({
      where: { id: { in: ids }, status: 'ACTIVE' as never },
    });
    return rows.map((row: never) => this.toRecord(row));
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
      items: rows.map((row: never) => this.toRecord(row)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  private toRecord(row: never): ProductQueryRecord {
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
