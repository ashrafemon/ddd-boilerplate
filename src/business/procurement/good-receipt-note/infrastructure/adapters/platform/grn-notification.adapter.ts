import { Injectable } from '@nestjs/common';
import { NotificationHandler } from '@platform/notification/ports/notification-handler.port';
import { Recipient, TemplateModel } from '@platform/notification/notification.types';
import { GetGrnUseCase } from '../../../application/usecases/get-grn.usecase';
import { PurchaseOrderPort } from '../../../application/outbound-ports/purchase-order-query.port';

/**
 * NotificationHandler for notificationType 'GoodsReceiptPosted' — pure port
 * data + routing, no lifecycle, no registry import: the composition root
 * (src/bootstrap/configure-notifications.ts) registers it on
 * NotificationHandlerRegistry at boot, keyed to the GoodsReceiptPosted domain
 * event by eventName. Answers WHO (warehouse/receiving) and WITH WHAT DATA
 * (the rendered model) only — never renders a template or calls a channel.
 *
 * Recipients: the warehouse/receiving directory is part of the DEFERRED IAM
 * build (docs/IAM-BUILD-PLAN.md, out of this plan's scope), so there is no
 * address to resolve yet. The platform finalises zero-recipient requests as
 * `NO_RECIPIENTS` — a normal state, not a failure — so the event path stays
 * green and recipients light up the moment the directory lands.
 */
@Injectable()
export class GrnNotificationAdapter implements NotificationHandler {
  constructor(
    private readonly getGrn: GetGrnUseCase,
    private readonly purchaseOrderPort: PurchaseOrderPort,
  ) {}

  resolveRecipients(
    payload: Record<string, unknown> | undefined,
    context: unknown,
  ): Promise<Recipient[]> {
    void payload;
    void context;
    return Promise.resolve([]);
  }

  async resolveModel(payload: Record<string, unknown> | undefined): Promise<TemplateModel> {
    const grn = await this.findGrn(payload);
    if (!grn) {
      return {};
    }
    const purchaseOrder = await this.purchaseOrderPort.getPurchaseOrder(grn.purchaseOrderId);
    return {
      grnNumber: grn.grnNumber,
      purchaseOrderId: grn.purchaseOrderId,
      orderNumber: purchaseOrder?.orderNumber ?? '',
      vendorId: grn.vendorId,
      status: grn.status,
      currency: grn.currency,
      total: grn.total,
      receivedAt: grn.receivedAt ?? '',
    };
  }

  private findGrn(payload: Record<string, unknown> | undefined) {
    const grnId = extractGrnId(payload);
    return grnId ? this.getGrn.execute(grnId) : Promise.resolve(null);
  }
}

/** Reads the plain-string `grnId` the GoodsReceiptPosted envelope carries. */
function extractGrnId(payload: Record<string, unknown> | undefined): string | null {
  const raw = payload?.grnId;
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
}
