import { Injectable } from '@nestjs/common';
import { PrismaReadPort } from '@platform/context/ports/prisma-read.port';
import { PageQuery, PageResult } from '@shared-kernel/types/pagination';
import { PurchaseOrderQuery } from '@business/procurement/purchase-order/application/queries/purchase-order.query';
import { PurchaseOrderQueryRecord } from '@business/procurement/purchase-order/domain/types/purchase-order.types';
import { PrismaPurchaseOrderMapper } from './prisma-purchase-order.mapper';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { TenantScope } from '@shared-kernel/utils/tenant-scope.util';

@Injectable()
export class PrismaPurchaseOrderQueryRepository extends PurchaseOrderQuery {
  constructor(
    private readonly prismaRead: PrismaReadPort,
    private readonly requestContext: RequestContextPort,
  ) {
    super();
  }

  /**
   * A purchase order is an OWNED document: a tenant-scoped request reads only
   * its own rows. A row owned by another tenant is NOT FOUND — never a 403,
   * so there is no existence leak.
   */
  private ownedScope(): { tenantId?: string } {
    return TenantScope.where<{ tenantId?: string }>(this.requestContext.getTenantId());
  }

  async findById(id: string): Promise<PurchaseOrderQueryRecord | null> {
    const row = await this.prismaRead.purchaseOrder.findFirst({
      where: { id, ...this.ownedScope() },
      include: { lines: true },
    });
    return row ? PrismaPurchaseOrderMapper.toRecord(row as never) : null;
  }

  async findByOrderNumber(orderNumber: string): Promise<PurchaseOrderQueryRecord | null> {
    const row = await this.prismaRead.purchaseOrder.findFirst({
      where: { orderNumber, ...this.ownedScope() },
      include: { lines: true },
    });
    return row ? PrismaPurchaseOrderMapper.toRecord(row as never) : null;
  }

  async findAll(query: PageQuery): Promise<PageResult<PurchaseOrderQueryRecord>> {
    const skip = (query.page - 1) * query.pageSize;
    const [rows, total] = await Promise.all([
      this.prismaRead.purchaseOrder.findMany({
        where: this.ownedScope(),
        skip,
        take: query.pageSize,
        orderBy: { createdAt: 'desc' },
        include: { lines: true },
      }),
      this.prismaRead.purchaseOrder.count({ where: this.ownedScope() }),
    ]);
    return {
      items: rows.map((row: never) => PrismaPurchaseOrderMapper.toRecord(row)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }
}
