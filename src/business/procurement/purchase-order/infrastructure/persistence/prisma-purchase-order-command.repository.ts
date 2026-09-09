import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { PurchaseOrder } from '@business/procurement/purchase-order/domain/aggregates/purchase-order.aggregate';
import { PurchaseOrderId } from '@business/procurement/purchase-order/domain/value-objects/purchase-order-id.vo';
import { PurchaseOrderCommandRepository } from '@business/procurement/purchase-order/domain/repositories/purchase-order-command.repository';
import { PrismaPurchaseOrderMapper } from './prisma-purchase-order.mapper';
import { PageQuery } from '@shared-kernel/types/pagination';

@Injectable()
export class PrismaPurchaseOrderCommandRepository extends PurchaseOrderCommandRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {
    super();
  }

  async save(purchaseOrder: PurchaseOrder): Promise<PurchaseOrder> {
    await this.txHost.tx.purchaseOrder.create({
      data: {
        ...PrismaPurchaseOrderMapper.toRow(purchaseOrder),
        lines: { create: PrismaPurchaseOrderMapper.toLinesCreateInput(purchaseOrder) },
      } as never,
    });
    return purchaseOrder;
  }

  async update(purchaseOrder: PurchaseOrder): Promise<PurchaseOrder> {
    await this.txHost.tx.purchaseOrder.update({
      where: { id: purchaseOrder.id.toString() },
      data: {
        ...PrismaPurchaseOrderMapper.toRow(purchaseOrder),
        lines: {
          deleteMany: {},
          create: PrismaPurchaseOrderMapper.toLinesCreateInput(purchaseOrder),
        },
      } as never,
    });
    return purchaseOrder;
  }

  async findById(id: PurchaseOrderId): Promise<PurchaseOrder | null> {
    const row = await this.txHost.tx.purchaseOrder.findUnique({
      where: { id: id.toString() },
      include: { lines: true },
    });
    return row ? PrismaPurchaseOrderMapper.toDomain(row) : null;
  }

  async findByOrderNumber(orderNumber: string): Promise<PurchaseOrder | null> {
    const row = await this.txHost.tx.purchaseOrder.findUnique({
      where: { orderNumber },
      include: { lines: true },
    });
    return row ? PrismaPurchaseOrderMapper.toDomain(row) : null;
  }

  async nextOrderSequence(): Promise<number> {
    const last = await this.txHost.tx.purchaseOrder.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { orderNumber: true },
    });
    if (!last) return 1;
    const match = /^PO-(\d+)$/.exec(last.orderNumber);
    return match ? parseInt(match[1], 10) + 1 : 0;
  }

  async findAll(query: PageQuery) {
    const skip = (query.page - 1) * query.pageSize;
    const [rows, total] = await Promise.all([
      this.txHost.tx.purchaseOrder.findMany({
        skip,
        take: query.pageSize,
        orderBy: { createdAt: 'desc' },
        include: { lines: true },
      }),
      this.txHost.tx.purchaseOrder.count(),
    ]);
    return {
      items: rows.map((row: never) => PrismaPurchaseOrderMapper.toDomain(row)),
      total,
    };
  }
}
