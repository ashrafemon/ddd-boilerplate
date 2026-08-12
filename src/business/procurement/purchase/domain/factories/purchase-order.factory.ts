import { DomainFactory } from '@business/shared-business/domain/factories/factory.base';
import {
  PurchaseOrder,
  CreatePurchaseOrderInput,
  PurchaseOrderProps,
  PurchaseOrderStatus,
} from '../entities/purchase-order.aggregate';
import { PurchaseOrderId } from '../value-objects/purchase-order-id.vo';
import { OrderNumber, VendorIdRef } from '../value-objects/purchase-order.vos';
import { PurchaseOrderCreated } from '../events/purchase-order.events';
import './../invariants/purchase-order.invariants';
import './../policies/purchase-order.policy';

/**
 * PurchaseOrder domain factory — single entry point for creating and
 * rehydrating PurchaseOrder aggregates.
 */
export class PurchaseOrderFactory extends DomainFactory<PurchaseOrder, CreatePurchaseOrderInput> {
  create(input: CreatePurchaseOrderInput): PurchaseOrder {
    const now = new Date();
    const purchaseOrder = PurchaseOrder.instantiate(
      PurchaseOrderId.generate(),
      {
        orderNumber: OrderNumber.create(input.orderNumber),
        vendorId: new VendorIdRef(input.vendorId),
        status: PurchaseOrderStatus.DRAFT,
        currency: input.currency ?? 'USD',
        lines: [],
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

  reconstitute(id: PurchaseOrderId, props: PurchaseOrderProps, version: number): PurchaseOrder {
    return PurchaseOrder.instantiate(id, props, version);
  }
}

export const purchaseOrderFactory = new PurchaseOrderFactory();
