import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { PurchaseOrder } from '@business/procurement/purchase-order/domain/aggregates/purchase-order.aggregate';
import { PurchaseOrderLine } from '@business/procurement/purchase-order/domain/entities/purchase-order-line.entity';
import { PurchaseOrderId } from '@business/procurement/purchase-order/domain/value-objects/purchase-order-id.vo';
import {
  OrderNumber,
  ProductIdRef,
  VendorIdRef,
} from '@business/procurement/purchase-order/domain/value-objects/purchase-order.vos';
import { PurchaseOrderCommandRepository } from '@business/procurement/purchase-order/domain/repositories/purchase-order-command.repository';
import { Money } from '@business/shared-business/domain/common/value-objects/money';
import { PurchaseOrderProps, PurchaseOrderStatus } from '../../domain/types/purchase-order.types';
import { PageQuery } from '@shared-kernel/types/pagination';

@Injectable()
export class PrismaPurchaseOrderCommandRepository extends PurchaseOrderCommandRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {
    super();
  }

  async save(purchaseOrder: PurchaseOrder): Promise<PurchaseOrder> {
    await this.txHost.tx.purchaseOrder.create({
      data: {
        ...this.toRow(purchaseOrder),
        lines: { create: this.toLinesCreateInput(purchaseOrder) },
      } as never,
    });
    return purchaseOrder;
  }

  async update(purchaseOrder: PurchaseOrder): Promise<PurchaseOrder> {
    await this.txHost.tx.purchaseOrder.update({
      where: { id: purchaseOrder.id.toString() },
      data: {
        ...this.toRow(purchaseOrder),
        lines: {
          deleteMany: {},
          create: this.toLinesCreateInput(purchaseOrder),
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
    return row ? this.toDomain(row) : null;
  }

  async findByOrderNumber(orderNumber: string): Promise<PurchaseOrder | null> {
    const row = await this.txHost.tx.purchaseOrder.findUnique({
      where: { orderNumber },
      include: { lines: true },
    });
    return row ? this.toDomain(row) : null;
  }

  async nextOrderSequence(): Promise<number> {
    const last = await this.txHost.tx.purchaseOrder.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { orderNumber: true },
    });
    if (!last) return 1;
    const match = /^PO-(\d+)$/.exec(last.orderNumber);
    return match ? parseInt(match[1], 10) + 1 : 1;
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
      items: rows.map((row: never) => this.toDomain(row)),
      total,
    };
  }

  private toDomain(row: {
    id: string;
    orderNumber: string;
    vendorId: string;
    status: string;
    currency: string;
    lines: { productId: string; quantity: number; unitPrice: unknown; total: unknown }[];
    createdAt: Date;
    updatedAt: Date;
    version: number;
  }): PurchaseOrder {
    const lines = row.lines.map(
      line =>
        new PurchaseOrderLine(
          new ProductIdRef(line.productId),
          line.quantity,
          Money.fromDecimal(Number(line.unitPrice), row.currency),
          Money.fromDecimal(Number(line.total), row.currency),
        ),
    );

    return PurchaseOrder.instantiate(
      PurchaseOrderId.fromString(row.id),
      {
        orderNumber: OrderNumber.create(row.orderNumber),
        vendorId: new VendorIdRef(row.vendorId),
        status: row.status as PurchaseOrderStatus,
        currency: row.currency,
        lines,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      } satisfies PurchaseOrderProps,
      row.version,
    );
  }

  private toRow(purchaseOrder: PurchaseOrder) {
    return {
      id: purchaseOrder.id.toString(),
      orderNumber: purchaseOrder.orderNumber,
      vendorId: purchaseOrder.vendorId,
      status: purchaseOrder.status,
      currency: purchaseOrder.currency,
      subtotal: purchaseOrder.subtotal.toDecimal(),
      total: purchaseOrder.total.toDecimal(),
      version: purchaseOrder.getVersion(),
    };
  }

  private toLinesCreateInput(purchaseOrder: PurchaseOrder) {
    return purchaseOrder.lines.map(line => ({
      productId: line.productId.toString(),
      quantity: line.quantity,
      unitPrice: line.unitPrice.toDecimal(),
      total: line.total.toDecimal(),
    }));
  }
}
