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
      acceptedQuantity: number;
      rejectedQuantity: number;
      unitPrice: number;
      total: number;
    }[];
    receivedAt: Date | null;
    reversalOfId?: string | null;
    createdBy?: string | null;
    receivedBy?: string | null;
    postedBy?: string | null;
    cancelledBy?: string | null;
    createdAt: Date;
    updatedAt: Date;
    version: number;
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
            line.acceptedQuantity,
            line.rejectedQuantity,
          ),
        ),
        receivedAt: row.receivedAt,
        reversalOfId: row.reversalOfId ?? null,
        createdBy: row.createdBy ?? null,
        receivedBy: row.receivedBy ?? null,
        postedBy: row.postedBy ?? null,
        cancelledBy: row.cancelledBy ?? null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      } satisfies GrnProps,
      row.version,
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
      receivedAt: grn.receivedAt,
      reversalOfId: grn.reversalOfId,
      createdBy: grn.createdBy,
      receivedBy: grn.receivedBy,
      postedBy: grn.postedBy,
      cancelledBy: grn.cancelledBy,
      createdAt: grn.createdAt,
      updatedAt: grn.updatedAt,
      // `version` is intentionally NOT written here: the command repository
      // owns it via `version: { increment: 1 }` inside the CAS guard (Phase 0.6).
    };
  }

  static toLinesCreateInput(grn: GoodReceiptNote) {
    return grn.lines.map(line => ({
      productId: line.productId,
      orderedQuantity: line.orderedQuantity,
      receivedQuantity: line.receivedQuantity,
      acceptedQuantity: line.acceptedQuantity,
      rejectedQuantity: line.rejectedQuantity,
      unitPrice: line.unitPrice,
      total: line.total,
    }));
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
        acceptedQuantity: number;
        rejectedQuantity: number;
        unitPrice: number;
        total: number;
      }[];
      receivedAt: Date | null;
      reversalOfId?: string | null;
      createdBy?: string | null;
      receivedBy?: string | null;
      postedBy?: string | null;
      cancelledBy?: string | null;
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
      reversalOfId: r.reversalOfId ?? null,
      createdBy: r.createdBy ?? null,
      receivedBy: r.receivedBy ?? null,
      postedBy: r.postedBy ?? null,
      cancelledBy: r.cancelledBy ?? null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
}
