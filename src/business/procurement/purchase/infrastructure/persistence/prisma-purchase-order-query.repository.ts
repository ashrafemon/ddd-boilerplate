import { Injectable } from '@nestjs/common';
import { PrismaReadService } from '@infrastructure/database/prisma/prisma-read.service';
import { PageQuery, PageResult } from '@shared-kernel/types/pagination';
import { PurchaseOrderQueryRepositoryPort } from '@business/procurement/purchase/domain/ports/purchase-order-query-repository.port';
import { PurchaseOrderQueryRecord } from '@business/procurement/purchase/domain/types/purchase-order.types';

@Injectable()
export class PrismaPurchaseOrderQueryRepository extends PurchaseOrderQueryRepositoryPort {
  constructor(private readonly prismaRead: PrismaReadService) {
    super();
  }

  async findById(id: string): Promise<PurchaseOrderQueryRecord | null> {
    const row = await this.prismaRead.purchaseOrder.findUnique({
      where: { id },
      include: { lines: true },
    });
    return row ? this.toRecord(row as never) : null;
  }

  async findByOrderNumber(orderNumber: string): Promise<PurchaseOrderQueryRecord | null> {
    const row = await this.prismaRead.purchaseOrder.findUnique({
      where: { orderNumber },
      include: { lines: true },
    });
    return row ? this.toRecord(row as never) : null;
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
      items: rows.map((row: never) => this.toRecord(row)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  private toRecord(row: never): PurchaseOrderQueryRecord {
    const r = row as {
      id: string;
      orderNumber: string;
      vendorId: string;
      status: string;
      currency: string;
      subtotal: { toString(): string };
      total: { toString(): string };
      lines: {
        productId: string;
        quantity: number;
        unitPrice: { toString(): string };
        total: { toString(): string };
      }[];
      createdAt: Date;
      updatedAt: Date;
    };
    return {
      id: r.id,
      orderNumber: r.orderNumber,
      vendorId: r.vendorId,
      status: r.status,
      currency: r.currency,
      subtotal: Number(r.subtotal.toString()),
      total: Number(r.total.toString()),
      lines: r.lines.map(line => ({
        productId: line.productId,
        quantity: line.quantity,
        unitPrice: Number(line.unitPrice.toString()),
        total: Number(line.total.toString()),
      })),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
}
