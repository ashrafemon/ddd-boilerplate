import { Injectable } from '@nestjs/common';
import { PrismaReadPort } from '@platform/context/ports/prisma-read.port';
import { PageQuery, PageResult } from '@shared-kernel/types/pagination';
import { PurchaseOrderQuery } from '@business/procurement/purchase-order/application/queries/purchase-order.query';
import {
  PurchaseOrderQueryRecord,
  PurchaseOrderReceiptsQueryRecord,
} from '@business/procurement/purchase-order/domain/types/purchase-order.types';
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

  /**
   * The receipt projection of one order.
   *
   * The order is resolved FIRST through the owned scope, so a foreign order
   * never reaches the line query: the lines have no tenant column of their
   * own (they hang off the order), so the visibility gate has to happen
   * here. A missing or foreign order yields `null` — the read use case
   * turns that into 404, never a 403.
   */
  async findReceipts(purchaseOrderId: string): Promise<PurchaseOrderReceiptsQueryRecord | null> {
    const order = await this.prismaRead.purchaseOrder.findFirst({
      where: { id: purchaseOrderId, ...this.ownedScope() },
      select: { id: true },
    });
    if (!order) {
      return null;
    }

    const lines = await this.prismaRead.purchaseOrderLine.findMany({
      where: { purchaseOrderId: order.id },
      orderBy: { productId: 'asc' },
      select: { productId: true, quantity: true, receivedQuantity: true },
    });

    return {
      purchaseOrderId: order.id,
      lines: lines.map(line => ({
        productId: line.productId,
        orderedQuantity: line.quantity,
        receivedQuantity: line.receivedQuantity,
        remainingQuantity: Math.max(0, line.quantity - line.receivedQuantity),
      })),
    };
  }

  /**
   * Whether the order already carries received quantities. Same owned-scope
   * gate as `findReceipts`: a foreign order is simply "no receipts".
   */
  async hasReceipts(purchaseOrderId: string): Promise<boolean> {
    const order = await this.prismaRead.purchaseOrder.findFirst({
      where: { id: purchaseOrderId, ...this.ownedScope() },
      select: {
        lines: {
          where: { receivedQuantity: { gt: 0 } },
          select: { id: true },
        },
      },
    });
    return (order?.lines.length ?? 0) > 0;
  }
}
