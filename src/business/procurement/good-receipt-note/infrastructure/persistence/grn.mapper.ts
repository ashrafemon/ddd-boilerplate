import { Grn, GrnLine, GrnProps, GrnStatus } from '../../domain/types/grn.types';
import { GrnId, GrnNumber, PurchaseOrderIdRef, ReceivedQuantity } from '../../domain/value-objects';

export class GrnMapper {
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
  }): Grn {
    const grn = Grn.instantiate(
      GrnId.fromString(row.id),
      {
        grnNumber: row.grnNumber,
        purchaseOrderId: row.purchaseOrderId,
        vendorId: row.vendorId,
        status: row.status as GrnStatus,
        currency: row.currency,
        lines: row.lines.map(line =>
          GrnLine.create(line.productId, line.orderedQuantity, line.receivedQuantity, line.unitPrice),
        ),
        receivedAt: row.receivedAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
      1,
    );
    return grn;
  }

  static toRow(grn: Grn) {
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