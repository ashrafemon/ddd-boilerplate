import { PurchaseOrder } from '@business/procurement/purchase-order/domain/aggregates/purchase-order.aggregate';
import { PurchaseOrderLine } from '@business/procurement/purchase-order/domain/entities/purchase-order-line.entity';
import { PurchaseOrderId } from '@business/procurement/purchase-order/domain/value-objects/purchase-order-id.vo';
import {
  OrderNumber,
  ProductIdRef,
  VendorIdRef,
} from '@business/procurement/purchase-order/domain/value-objects/purchase-order.vos';
import { Money } from '@business/shared-business/domain/common/value-objects/money';
import { PurchaseOrderQueryRecord } from '../../domain/types/purchase-order.types';
import { PurchaseOrderProps, PurchaseOrderStatus } from '../../domain/types/purchase-order.types';

export class PrismaPurchaseOrderMapper {
  static toDomain(row: {
    id: string;
    orderNumber: string;
    vendorId: string;
    externalReference?: string | null;
    status: string;
    currency: string;
    orderDate?: Date | null;
    expectedDeliveryDate?: Date | null;
    createdBy?: string | null;
    approvedBy?: string | null;
    approvedAt?: Date | null;
    rejectedBy?: string | null;
    rejectedAt?: Date | null;
    rejectionReason?: string | null;
    issuedBy?: string | null;
    cancelledBy?: string | null;
    lines: {
      productId: string;
      quantity: number;
      receivedQuantity: number;
      descriptionSnapshot?: string | null;
      unitPrice: unknown;
      total: unknown;
    }[];
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
          line.receivedQuantity ?? 0,
          line.descriptionSnapshot ?? null,
        ),
    );

    return PurchaseOrder.instantiate(
      PurchaseOrderId.fromString(row.id),
      {
        orderNumber: OrderNumber.create(row.orderNumber),
        vendorId: new VendorIdRef(row.vendorId),
        externalReference: row.externalReference ?? undefined,
        status: row.status as PurchaseOrderStatus,
        currency: row.currency,
        orderDate: row.orderDate ?? null,
        expectedDeliveryDate: row.expectedDeliveryDate ?? null,
        createdBy: row.createdBy ?? null,
        approvedBy: row.approvedBy ?? null,
        approvedAt: row.approvedAt ?? null,
        rejectedBy: row.rejectedBy ?? null,
        rejectedAt: row.rejectedAt ?? null,
        rejectionReason: row.rejectionReason ?? null,
        issuedBy: row.issuedBy ?? null,
        cancelledBy: row.cancelledBy ?? null,
        lines,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      } satisfies PurchaseOrderProps,
      row.version,
    );
  }

  static toRow(purchaseOrder: PurchaseOrder) {
    return {
      id: purchaseOrder.id.toString(),
      orderNumber: purchaseOrder.orderNumber,
      vendorId: purchaseOrder.vendorId,
      externalReference: purchaseOrder.externalReference ?? null,
      status: purchaseOrder.status,
      currency: purchaseOrder.currency,
      orderDate: purchaseOrder.orderDate,
      expectedDeliveryDate: purchaseOrder.expectedDeliveryDate,
      createdBy: purchaseOrder.createdBy,
      approvedBy: purchaseOrder.approvedBy,
      approvedAt: purchaseOrder.approvedAt,
      rejectedBy: purchaseOrder.rejectedBy,
      rejectedAt: purchaseOrder.rejectedAt,
      rejectionReason: purchaseOrder.rejectionReason,
      issuedBy: purchaseOrder.issuedBy,
      cancelledBy: purchaseOrder.cancelledBy,
      subtotal: purchaseOrder.subtotal.toDecimal(),
      total: purchaseOrder.total.toDecimal(),
      // `version` is intentionally NOT written here: the command repository
      // owns it via `version: { increment: 1 }` inside the CAS guard (Phase 0.6).
    };
  }

  static toLinesCreateInput(purchaseOrder: PurchaseOrder) {
    return purchaseOrder.lines.map(line => ({
      productId: line.productId.toString(),
      quantity: line.quantity,
      receivedQuantity: line.receivedQuantity,
      descriptionSnapshot: line.descriptionSnapshot,
      unitPrice: line.unitPrice.toDecimal(),
      total: line.total.toDecimal(),
    }));
  }

  static toRecord(row: never): PurchaseOrderQueryRecord {
    const r = row as {
      id: string;
      orderNumber: string;
      vendorId: string;
      externalReference?: string | null;
      status: string;
      currency: string;
      orderDate?: Date | null;
      expectedDeliveryDate?: Date | null;
      subtotal: { toString(): string };
      total: { toString(): string };
      lines: {
        productId: string;
        quantity: number;
        receivedQuantity: number;
        descriptionSnapshot?: string | null;
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
      externalReference: r.externalReference ?? null,
      status: r.status,
      currency: r.currency,
      orderDate: r.orderDate ?? null,
      expectedDeliveryDate: r.expectedDeliveryDate ?? null,
      subtotal: Number(r.subtotal.toString()),
      total: Number(r.total.toString()),
      lines: r.lines.map(line => ({
        productId: line.productId,
        quantity: line.quantity,
        receivedQuantity: line.receivedQuantity,
        descriptionSnapshot: line.descriptionSnapshot ?? null,
        unitPrice: Number(line.unitPrice.toString()),
        total: Number(line.total.toString()),
      })),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
}
