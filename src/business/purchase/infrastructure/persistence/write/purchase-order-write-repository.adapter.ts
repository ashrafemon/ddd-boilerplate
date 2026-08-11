import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { AggregateNotFoundException } from '../../../../../shared-kernel/exceptions/aggregate-not-found.exception';
import { PurchaseOrder } from '../../../domain/aggregate/purchase-order/purchase-order.entity';
import { PurchaseOrderId } from '../../../domain/aggregate/purchase-order/purchase-order-id.vo';
import {
  PurchaseOrderCreatePersistenceData,
  PurchaseOrderLinePersistenceData,
  PurchaseOrderPersistenceData,
  PurchaseOrderWriteRepositoryPort,
} from '../../../domain/port/purchase-order-write-repository.port';
import { PurchaseOrderBuilder } from '../../../domain/service/purchase-order-builder.service';
import { PurchaseOrderMapper } from '../purchase-order.mapper';

type TxClient = Prisma.TransactionClient;

/**
 * Write-side persistence for the PurchaseOrder aggregate. Joins the
 * CLS-managed transaction transparently.
 *
 * The repository persists plain data (`PurchaseOrderPersistenceData`) — it
 * never receives the aggregate. The domain is only used to enforce
 * invariants and record domain events.
 */
@Injectable()
export class PrismaPurchaseOrderWriteRepositoryAdapter implements PurchaseOrderWriteRepositoryPort {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
    private readonly builder: PurchaseOrderBuilder,
  ) {}

  public async save(data: PurchaseOrderPersistenceData): Promise<void> {
    const client = this.getClient();

    if (data.operation === 'create') {
      await client.purchaseOrder.create({
        data: {
          id: data.id,
          tenantId: data.tenantId,
          organizationId: data.organizationId,
          number: data.number,
          vendorId: data.vendorId,
          status: data.status,
          currency: data.currency,
          totalCents: data.totalCents,
          notes: data.notes ?? null,
          submittedAt: data.submittedAt ?? null,
          approvedAt: data.approvedAt ?? null,
          approvedByUserId: data.approvedByUserId ?? null,
          rejectedAt: data.rejectedAt ?? null,
          rejectedReason: data.rejectedReason ?? null,
          cancelledAt: data.cancelledAt ?? null,
          cancelledReason: data.cancelledReason ?? null,
          completedAt: data.completedAt ?? null,
          lines: data.lines.length
            ? { create: data.lines.map((line) => this.toLineCreate(data, line)) }
            : undefined,
        },
      });
      return;
    }

    const existing = await client.purchaseOrder.findUnique({ where: { id: data.id } });
    if (!existing) {
      throw new AggregateNotFoundException('PurchaseOrder', data.id);
    }

    await client.purchaseOrder.update({
      where: { id: data.id },
      data: {
        vendorId: data.vendorId,
        status: data.status,
        totalCents: data.totalCents,
        notes: data.notes,
        submittedAt: data.submittedAt,
        approvedAt: data.approvedAt,
        approvedByUserId: data.approvedByUserId,
        rejectedAt: data.rejectedAt,
        rejectedReason: data.rejectedReason,
        cancelledAt: data.cancelledAt,
        cancelledReason: data.cancelledReason,
        completedAt: data.completedAt,
      },
    });

    if (data.lines !== undefined) {
      await client.purchaseOrderLine.deleteMany({ where: { purchaseOrderId: data.id } });
      if (data.lines.length > 0) {
        await client.purchaseOrderLine.createMany({
          data: data.lines.map((line) => ({
            id: line.id,
            purchaseOrderId: data.id,
            tenantId: existing.tenantId,
            organizationId: existing.organizationId,
            lineNumber: line.lineNumber,
            productId: line.productId,
            description: line.description,
            quantity: new Prisma.Decimal(line.quantity),
            unitPriceCents: line.unitPriceCents,
            taxRateBps: line.taxRateBps,
            netAmountCents: line.netAmountCents,
            taxAmountCents: line.taxAmountCents,
            totalCents: line.totalCents,
          })),
        });
      }
    }
  }

  public async findById(id: PurchaseOrderId): Promise<PurchaseOrder | null> {
    const client = this.getClient();
    const row = await client.purchaseOrder.findUnique({
      where: { id: id.getValue() },
      include: { lines: true },
    });
    if (!row) return null;

    const vendor = await client.vendor.findUnique({
      where: { id: row.vendorId },
      select: { id: true, code: true, name: true },
    });

    return this.builder.reconstitute(PurchaseOrderMapper.toSnapshot(row, vendor, row.currency));
  }

  private toLineCreate(
    data: PurchaseOrderCreatePersistenceData,
    line: PurchaseOrderLinePersistenceData,
  ): Prisma.PurchaseOrderLineUncheckedCreateWithoutPurchaseOrderInput {
    return {
      id: line.id,
      tenantId: data.tenantId,
      organizationId: data.organizationId,
      lineNumber: line.lineNumber,
      productId: line.productId,
      description: line.description,
      quantity: new Prisma.Decimal(line.quantity),
      unitPriceCents: line.unitPriceCents,
      taxRateBps: line.taxRateBps,
      netAmountCents: line.netAmountCents,
      taxAmountCents: line.taxAmountCents,
      totalCents: line.totalCents,
    };
  }

  private getClient(): TxClient {
    return this.txHost.tx;
  }
}
