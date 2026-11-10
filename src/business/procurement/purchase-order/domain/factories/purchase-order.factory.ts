import { PurchaseOrder } from '../aggregates/purchase-order.aggregate';
import { PurchaseOrderProps } from '../types/purchase-order.types';
import { PurchaseOrderStatus } from '../types/purchase-order.enum';
import { CreatePurchaseOrderInput } from '../types/purchase-order.types';
import { PurchaseOrderId } from '../value-objects/purchase-order-id.vo';
import { PurchaseOrderLine } from '../entities/purchase-order-line.entity';
import { OrderNumber } from '../value-objects/order-number.vo';
import { VendorIdRef } from '../value-objects/vendor-id-ref.vo';
import { PurchaseOrderCreated } from '../events/purchase-order.created.event';
import { PurchaseOrderInvariants } from '../aggregates/purchase-order.invariants';
import { OrderNumberInvariants } from '../value-objects/order-number.invariants';
import { OverReceiptPolicy } from '../policies/over-receipt.policy';

export class PurchaseOrderFactory {
  static create(input: CreatePurchaseOrderInput): PurchaseOrder {
    PurchaseOrderInvariants.enforcePurchaseOrderCreate(input.orderNumber, input.vendorId);
    OrderNumberInvariants.enforceOrderNumberCreate(input.orderNumber);

    const now = new Date();
    const purchaseOrder = PurchaseOrder.instantiate(
      PurchaseOrderId.generate(),
      {
        orderNumber: OrderNumber.create(input.orderNumber),
        vendorId: new VendorIdRef(input.vendorId),
        externalReference: input.externalReference,
        status: PurchaseOrderStatus.DRAFT,
        currency: input.currency ?? 'USD',
        lines: [],
        orderDate: input.orderDate ?? now,
        expectedDeliveryDate: input.expectedDeliveryDate ?? null,
        createdBy: input.createdBy ?? null,
        approvedBy: null,
        approvedAt: null,
        rejectedBy: null,
        rejectedAt: null,
        issuedBy: null,
        cancelledBy: null,
        createdAt: now,
        updatedAt: now,
      },
      1,
    );

    purchaseOrder.addEvent(
      new PurchaseOrderCreated(purchaseOrder.id, purchaseOrder.orderNumber, input.vendorId),
    );
    return purchaseOrder;
  }

  static reconstitute(
    id: PurchaseOrderId,
    props: PurchaseOrderProps,
    version: number,
  ): PurchaseOrder {
    return PurchaseOrder.instantiate(id, props, version);
  }

  static openPoForReceipt(
    po: PurchaseOrder,
    request: {
      purchaseOrderId: string;
      lines: Array<{ productId: string; receivedQuantity: number }>;
      actorId?: string;
    },
    tolerance: number,
    _taxable: boolean,
    _paymentTerms: unknown,
    _currency: string,
    actorId: string | undefined,
  ): void {
    const eligible =
      po.status === PurchaseOrderStatus.ISSUED || po.status === PurchaseOrderStatus.APPROVED;
    if (!eligible) {
      throw Object.assign(new Error('Purchase order is not receiving-eligible'), {
        statusCode: 422,
      });
    }

    for (const line of request.lines) {
      if (line.productId === undefined || line.productId === null) {
        throw Object.assign(new Error('Product ID is required on each receipt line'), {
          statusCode: 404,
        });
      }

      const poLine = po.lines.find(l => line.productId.toString() === l.productId.toString());
      if (!poLine) {
        throw Object.assign(new Error(`Product ${line.productId} is not on the purchase order`), {
          statusCode: 404,
        });
      }

      OverReceiptPolicy.enforcePurchaseOrderOverReceipt(
        poLine.quantity,
        poLine.receivedQuantity,
        line.receivedQuantity,
        tolerance,
      );

      poLine.receive(line.receivedQuantity);
    }

    po.registerReceipt(actorId);
  }
}
