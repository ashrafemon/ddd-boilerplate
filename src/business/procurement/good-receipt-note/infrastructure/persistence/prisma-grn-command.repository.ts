import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { GoodReceiptNote } from '../../domain/aggregates/grn.aggregate';
import { GrnCommandRepository } from '../../domain/repositories/grn-command.repository';
import { GrnId } from '../../domain/value-objects/grn.vos';
import { GrnLine, GrnProps, GrnStatus } from '../../domain/types/grn.types';

@Injectable()
export class PrismaGrnCommandRepository extends GrnCommandRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {
    super();
  }

  async save(grn: GoodReceiptNote): Promise<GoodReceiptNote> {
    await (
      this.txHost.tx as never as {
        goodReceiptNote: { create: (args: { data: never }) => Promise<unknown> };
      }
    ).goodReceiptNote.create({ data: { ...this.toRow(grn) } as never });
    return grn;
  }

  async update(grn: GoodReceiptNote): Promise<GoodReceiptNote> {
    await (
      this.txHost.tx as never as {
        goodReceiptNote: {
          update: (args: { where: { id: string }; data: never }) => Promise<unknown>;
        };
      }
    ).goodReceiptNote.update({
      where: { id: grn.id.toString() },
      data: { ...this.toRow(grn) } as never,
    });
    return grn;
  }

  async findById(id: string): Promise<GoodReceiptNote | null> {
    const row = await (
      this.txHost.tx as never as {
        goodReceiptNote: { findUnique: (args: { where: { id: string } }) => Promise<unknown> };
      }
    ).goodReceiptNote.findUnique({ where: { id } });
    return row ? this.toDomain(row as never) : null;
  }

  async findByGrnNumber(grnNumber: string): Promise<GoodReceiptNote | null> {
    const row = await (
      this.txHost.tx as never as {
        goodReceiptNote: {
          findUnique: (args: { where: { grnNumber: string } }) => Promise<unknown>;
        };
      }
    ).goodReceiptNote.findUnique({ where: { grnNumber } });
    return row ? this.toDomain(row as never) : null;
  }

  async nextGrnSequence(): Promise<number> {
    const result = await this.txHost.tx.$queryRawUnsafe<{ next: number }[]>(
      `SELECT nextval('grn_sequence') as next`,
    );
    return result[0]?.next ?? 1;
  }

  private toDomain(row: {
    id: string;
    grnNumber: string;
    purchaseOrderId: string;
    vendorId: string;
    status: string;
    currency: string;
    subtotal: number;
    total: number;
    lines: {
      productId: string;
      orderedQuantity: number;
      receivedQuantity: number;
      unitPrice: number;
      total: number;
    }[];
    receivedAt: Date;
    createdAt: Date;
    updatedAt: Date;
  }): GoodReceiptNote {
    return GoodReceiptNote.instantiate(
      GrnId.fromString(row.id),
      {
        id: GrnId.fromString(row.id),
        grnNumber: row.grnNumber,
        purchaseOrderId: row.purchaseOrderId,
        vendorId: row.vendorId,
        status: row.status as GrnStatus,
        currency: row.currency,
        lines: row.lines.map(line =>
          GrnLine.create(
            line.productId,
            line.orderedQuantity,
            line.receivedQuantity,
            line.unitPrice,
          ),
        ),
        receivedAt: row.receivedAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      } satisfies GrnProps,
      1,
    );
  }

  private toRow(grn: GoodReceiptNote) {
    return {
      id: grn.id.toString(),
      grnNumber: grn.grnNumber,
      purchaseOrderId: grn.purchaseOrderId,
      vendorId: grn.vendorId,
      status: grn.status,
      currency: grn.currency,
      subtotal: grn.subtotal,
      total: grn.total,
      lines: grn.lines.map(line => ({
        productId: line.productId,
        orderedQuantity: line.orderedQuantity,
        receivedQuantity: line.receivedQuantity,
        unitPrice: line.unitPrice,
        total: line.total,
      })),
      receivedAt: grn.receivedAt,
      createdAt: grn.createdAt,
      updatedAt: grn.updatedAt,
    };
  }
}
