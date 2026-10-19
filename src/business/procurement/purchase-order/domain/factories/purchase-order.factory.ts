import { invariantRegistry } from '@business/shared-business/domain/registries/invariant.registry';
import { policyRegistry } from '@business/shared-business/domain/registries/policy.registry';
import { PurchaseOrder } from '../aggregates/purchase-order.aggregate';
import { PurchaseOrderProps } from '../types/purchase-order.types';
import { PurchaseOrderStatus } from '../types/purchase-order.enum';
import { CreatePurchaseOrderInput } from '../types/purchase-order.types';
import { PurchaseOrderId } from '../value-objects/purchase-order-id.vo';
import { PurchaseOrderLine } from '../entities/purchase-order-line.entity';
import { OrderNumber, VendorIdRef } from '../value-objects/purchase-order.vos';
import { PurchaseOrderCreated } from '../events/purchase-order.created.event';
import './../aggregates/purchase-order.invariants';
import '../value-objects/order-number.invariants';
import './../policies/approval.policy';
import './../policies/cancellation.policy';
import './../policies/over-receipt.policy';

export class PurchaseOrderFactory {
  static create(input: CreatePurchaseOrderInput): PurchaseOrder {
    invariantRegistry.enforce('purchase-order.create', {
      orderNumber: input.orderNumber,
      vendorId: input.vendorId,
    });

    invariantRegistry.enforce('order-number.create', { orderNumber: input.orderNumber });

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
        // Commercial header + actor trail (plan Phase 1.2 / 2.2). `orderDate`
        // defaults to the creation day; `createdBy` is null when no request
        // context exists (background/import workers) — never backfilled (E-4).
        orderDate: input.orderDate ?? now,
        expectedDeliveryDate: input.expectedDeliveryDate ?? null,
        createdBy: input.createdBy ?? null,
        approvedBy: null,
        approvedAt: null,
        rejectedBy: null,
        rejectedAt: null,
        rejectionReason: null,
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

  /**
   * Alternate-idempotent receipt registration (plan Phase 3.3). This is where
   * the receipt balance and caching contract live: the factory mutates PO
   * lines under its own invariants/policies so the command handler only
   * orchestrates + persists.
   *
   * Invariants/policies enforced here:
   * - PO must be receiving-eligible (ISSUED or APPROVED for backward compat).
   * - Vendor on every line must match PO vendor.
   * - Product on every line must exist on the PO.
   * - Over-receipt tolerance (per company) on the upper side only.
   * - Cancellation policy is NOT relevant here (receipt is additive).
   *
   * The command handler calls this, then persists the aggregate and invalidates
   * the read cache — never the other way around.
   */
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
          statusCode: 422,
        });
      }

      const poLine = po.lines.find(
        (l: PurchaseOrderLine) => l.productId.toString() === line.productId,
      );
      if (!poLine) {
        throw Object.assign(new Error(`Product ${line.productId} is not on the purchase order`), {
          statusCode: 404,
        });
      }

      policyRegistry.enforce('purchase-order.over-receipt', {
        orderedQuantity: poLine.quantity,
        alreadyReceived: poLine.receivedQuantity,
        proposedQuantity: line.receivedQuantity,
        tolerance,
      });

      // Positive = receive (balance grows), negative = reversal compensation (balance returns).
      // Reversal mirrors never increase the balance beyond what was received.
      poLine.receive(line.receivedQuantity);
    }

    po.recordReceipt(actorId);
  }
}
