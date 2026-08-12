import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { PurchaseOrder } from '@business/procurement/purchase/domain/entities/purchase-order.aggregate';
import { PurchaseOrderId } from '@business/procurement/purchase/domain/value-objects/purchase-order-id.vo';
import { PurchaseOrderCommandRepositoryPort } from '@business/procurement/purchase/domain/ports/purchase-order-command-repository.port';
import { PurchaseOrderMapper } from './purchase-order.mapper';
import { PageQuery } from '@shared-kernel/types/pagination';

@Injectable()
export class PrismaPurchaseOrderCommandRepository implements PurchaseOrderCommandRepositoryPort {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {}

  async save(purchaseOrder: PurchaseOrder): Promise<PurchaseOrder> {
    await this.txHost.tx.purchaseOrder.create({
      data: {
        ...PurchaseOrderMapper.toRow(purchaseOrder),
        lines: { create: PurchaseOrderMapper.toLinesCreateInput(purchaseOrder) },
      } as never,
    });
    return purchaseOrder;
  }

  async update(purchaseOrder: PurchaseOrder): Promise<PurchaseOrder> {
    await this.txHost.tx.purchaseOrder.update({
      where: { id: purchaseOrder.id.toString() },
      data: {
        ...PurchaseOrderMapper.toRow(purchaseOrder),
        lines: {
          deleteMany: {},
          create: PurchaseOrderMapper.toLinesCreateInput(purchaseOrder),
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
    return row ? PurchaseOrderMapper.toDomain(row) : null;
  }

  async findByOrderNumber(orderNumber: string): Promise<PurchaseOrder | null> {
    const row = await this.txHost.tx.purchaseOrder.findUnique({
      where: { orderNumber },
      include: { lines: true },
    });
    return row ? PurchaseOrderMapper.toDomain(row) : null;
  }

  async nextOrderSequence(): Promise<number> {
    const last = await this.txHost.tx.purchaseOrder.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { orderNumber: true },
    });
    if (!last) return 1;
    const match = /^PO-(\d+)$/.exec(last.orderNumber);
    const sequence = match ? parseInt(match[1], 10) : 0;
    return sequence + 1;
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
      items: rows.map((row: never) => PurchaseOrderMapper.toDomain(row)),
      total,
    };
  }
}
