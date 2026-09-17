import { Injectable } from '@nestjs/common';
import { NotificationHandler } from '@platform/notification/ports/notification-handler.port';
import { Recipient, TemplateModel } from '@platform/notification/notification.types';
import { GetPurchaseOrderUseCase } from '../../../application/usecases/get-purchase-order.usecase';
import { OrderableVendorPort } from '../../../application/outbound-ports/vendor-query.port';

/**
 * NotificationHandler for notificationType 'PurchaseOrderApproved' — pure
 * port data + routing, no lifecycle, no registry import: the composition
 * root (src/bootstrap/configure-notifications.ts) registers it on
 * NotificationHandlerRegistry at boot, keyed to the PurchaseOrderApproved
 * domain event by eventName. Answers WHO (the vendor's email) and WITH WHAT
 * DATA (the rendered model) only — never renders a template or calls a
 * channel provider.
 */
@Injectable()
export class PurchaseOrderNotificationAdapter implements NotificationHandler {
  constructor(
    private readonly getPurchaseOrder: GetPurchaseOrderUseCase,
    private readonly vendorQuery: OrderableVendorPort,
  ) {}

  async resolveRecipients(payload: Record<string, unknown> | undefined): Promise<Recipient[]> {
    const purchaseOrder = await this.findPurchaseOrder(payload);
    if (!purchaseOrder) {
      return [];
    }
    const vendor = await this.vendorQuery.getOrderableVendor(purchaseOrder.vendorId);
    if (!vendor?.email) {
      return [];
    }
    return [{ recipientRef: vendor.id, address: vendor.email }];
  }

  async resolveModel(payload: Record<string, unknown> | undefined): Promise<TemplateModel> {
    const purchaseOrder = await this.findPurchaseOrder(payload);
    if (!purchaseOrder) {
      return {};
    }
    const vendor = await this.vendorQuery.getOrderableVendor(purchaseOrder.vendorId);
    return {
      orderNumber: purchaseOrder.orderNumber,
      currency: purchaseOrder.currency,
      subtotal: purchaseOrder.subtotal,
      total: purchaseOrder.total,
      vendorName: vendor?.name ?? '',
    };
  }

  private findPurchaseOrder(payload: Record<string, unknown> | undefined) {
    const purchaseOrderId = extractPurchaseOrderId(payload);
    return purchaseOrderId ? this.getPurchaseOrder.execute(purchaseOrderId) : Promise.resolve(null);
  }
}

/** Reads the (eventId, purchaseOrderId: { value }, ...) envelope PurchaseOrderApproved
 * serialises to — same shape purchase-order.registry.ts's own rehydrator reads. */
function extractPurchaseOrderId(payload: Record<string, unknown> | undefined): string | null {
  const raw = payload?.purchaseOrderId;
  return raw && typeof raw === 'object' && typeof (raw as { value?: unknown }).value === 'string'
    ? (raw as { value: string }).value
    : null;
}
