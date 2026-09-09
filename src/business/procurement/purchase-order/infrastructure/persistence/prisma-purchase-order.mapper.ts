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

  static toRow(purchaseOrder: PurchaseOrder) {
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

  static toLinesCreateInput(purchaseOrder: PurchaseOrder) {
    return purchaseOrder.lines.map(line => ({
      productId: line.productId.toString(),
      quantity: line.quantity,
      unitPrice: line.unitPrice.toDecimal(),
      total: line.total.toDecimal(),
    }));
  }

  static toRecord(row: never): PurchaseOrderQueryRecord {
    const r = row as {
      id: string;
      orderNumber: string;
      vendorId: string;
      status: string;
      currency: string;
      subtotal: { toString(): string };
      total: { toString(): string };
      lines: {
        productId: string;
        quantity: number;
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
      status: r.status,
      currency: r.currency,
      subtotal: Number(r.subtotal.toString()),
      total: Number(r.total.toString()),
      lines: r.lines.map(line => ({
        productId: line.productId,
        quantity: line.quantity,
        unitPrice: Number(line.unitPrice.toString()),
        total: Number(line.total.toString()),
      })),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
}
