import { StockMovementQuery } from '@business/inventory/application/queries/stock-movement.query';
import { PrismaReadPort } from '@platform/platform-common/context/ports/prisma-read.port';
import { Injectable } from '@nestjs/common';
import { PageQuery, PageResult } from '@common/application/types/pagination';
import { StockMovementQueryRecord } from '../../../domain/types/stock-movement.types';
import { PrismaStockMovementMapper } from './prisma-stock-movement.mapper';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { TenantScope } from '@common/application/utils/tenant-scope';

@Injectable()
export class PrismaStockMovementQueryRepository extends StockMovementQuery {
  constructor(
    private readonly prismaRead: PrismaReadPort,
    private readonly requestContext: RequestContextPort,
  ) {
    super();
  }

  private sharedScope(): { OR: Array<{ tenantId: string | null }> } {
    return TenantScope.where<{ OR: Array<{ tenantId: string | null }> }>(
      this.requestContext.getTenantId(),
      { includeUnscoped: true },
    );
  }

  async findById(id: string): Promise<StockMovementQueryRecord | null> {
    const row = await this.prismaRead.stockMovement.findFirst({
      where: { id, ...this.sharedScope() } as never,
    });
    return row ? PrismaStockMovementMapper.toRecord(row as never) : null;
  }

  async findByProduct(
    productId: string,
    companyId?: string,
    tenantId?: string,
    query?: PageQuery,
  ): Promise<PageResult<StockMovementQueryRecord>> {
    const skip = ((query?.page ?? 1) - 1) * (query?.pageSize ?? 20);
    const take = query?.pageSize ?? 20;
    const where: Record<string, unknown> = {
      productId,
      ...this.sharedScope(),
      ...(companyId ? { companyId } : {}),
      ...(tenantId ? { tenantId } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prismaRead.stockMovement.findMany({
        where: where as never,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prismaRead.stockMovement.count({ where: where as never }),
    ]);
    return {
      items: rows.map((row: never) => PrismaStockMovementMapper.toRecord(row)),
      page: query?.page ?? 1,
      pageSize: query?.pageSize ?? 20,
      total,
      totalPages: Math.ceil(total / (query?.pageSize ?? 20)),
    };
  }

  async findBalance(
    productId: string,
    companyId?: string,
    tenantId?: string,
  ): Promise<{ productId: string; quantity: number } | null> {
    const where: Record<string, unknown> = {
      productId,
      ...this.sharedScope(),
      ...(companyId ? { companyId } : {}),
      ...(tenantId ? { tenantId } : {}),
    };
    const row = await this.prismaRead.stockBalance.findFirst({
      where: where as never,
    });
    return row ? { productId: row.productId, quantity: row.quantity } : null;
  }
}
