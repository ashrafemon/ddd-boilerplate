import {
  PurchaseOrder,
  PurchaseOrderProps,
  PurchaseOrderStatus,
} from '@business/procurement/purchase/domain/entities';
import { PurchaseOrderLine } from '@business/procurement/purchase/domain/entities/purchase-order-line.entity';
import { PurchaseOrderId } from '@business/procurement/purchase/domain/value-objects';
import {
  OrderNumber,
  ProductIdRef,
  VendorIdRef,
} from '@business/procurement/purchase/domain/value-objects/purchase-order.vos';
import { Money } from '@business/shared-business/domain/money.value-object';

interface PurchaseOrderLineRow {
  productId: string;
  quantity: number;
  unitPrice: unknown;
  total: unknown;
}

interface PurchaseOrderRow {
  id: string;
  orderNumber: string;
  vendorId: string;
  status: string;
  currency: string;
  lines: PurchaseOrderLineRow[];
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export class PurchaseOrderMapper {
  static toDomain(row: PurchaseOrderRow): PurchaseOrder {
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
}
