import { Injectable } from '@nestjs/common';
import { PrismaReadService } from '@infrastructure/database/prisma/prisma-read.service';
import { PageQuery, PageResult } from '@shared-kernel/types/pagination';
import { PurchaseOrderQuery } from '@business/procurement/purchase-order/application/queries/purchase-order.query';
import { PurchaseOrderQueryRecord } from '@business/procurement/purchase-order/domain/types/purchase-order.types';
import { PrismaPurchaseOrderMapper } from './prisma-purchase-order.mapper';

@Injectable()
export class PrismaPurchaseOrderQueryRepository extends PurchaseOrderQuery {
  constructor(private readonly prismaRead: PrismaReadService) {
    super();
  }

  async findById(id: string): Promise<PurchaseOrderQueryRecord | null> {
    const row = await this.prismaRead.purchaseOrder.findUnique({
      where: { id },
      include: { lines: true },
    });
    return row ? PrismaPurchaseOrderMapper.toRecord(row as never) : null;
  }

  async findByOrderNumber(orderNumber: string): Promise<PurchaseOrderQueryRecord | null> {
    const row = await this.prismaRead.purchaseOrder.findUnique({
      where: { orderNumber },
      include: { lines: true },
    });
    return row ? PrismaPurchaseOrderMapper.toRecord(row as never) : null;
  }

  async findAll(query: PageQuery): Promise<PageResult<PurchaseOrderQueryRecord>> {
    const skip = (query.page - 1) * query.pageSize;
    const [rows, total] = await Promise.all([
      this.prismaRead.purchaseOrder.findMany({
        skip,
        take: query.pageSize,
        orderBy: { createdAt: 'desc' },
        include: { lines: true },
      }),
      this.prismaRead.purchaseOrder.count(),
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
