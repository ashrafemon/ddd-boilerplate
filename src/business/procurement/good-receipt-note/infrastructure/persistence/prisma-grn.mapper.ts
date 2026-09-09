import { GoodReceiptNote } from '../../domain/aggregates/grn.aggregate';
import { GrnId } from '../../domain/value-objects/grn.vos';
import { GrnLine, GrnProps, GrnStatus } from '../../domain/types/grn.types';
import { GrnQueryRecord } from '../../domain/types/grn.types';

export class PrismaGrnMapper {
  static toDomain(row: {
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

  static toRow(grn: GoodReceiptNote) {
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

  static toRecord(row: never): GrnQueryRecord {
    const r = row as {
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
    };
    return {
      id: r.id,
      grnNumber: r.grnNumber,
      purchaseOrderId: r.purchaseOrderId,
      vendorId: r.vendorId,
      status: r.status,
      currency: r.currency,
      subtotal: r.subtotal,
      total: r.total,
      lines: r.lines,
      receivedAt: r.receivedAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
}
