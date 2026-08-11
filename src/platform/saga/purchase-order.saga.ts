import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PurchaseOrderSubmitted } from '@business/purchase-order/domain/events/purchase-order.events';
import { PurchaseOrderApprovalPolicy } from '@business/purchase-order/domain/policies/purchase-order.policy';
import { PurchaseOrderStatus } from '@business/purchase-order/domain/entities/purchase-order.aggregate';
import {
  PURCHASE_ORDER_COMMAND_PORT,
  PurchaseOrderCommandPort,
} from '@business/purchase-order/ports/inbound/purchase-order.command.port';
import {
  PURCHASE_ORDER_QUERY_PORT,
  PurchaseOrderQueryPort,
} from '@business/purchase-order/ports/inbound/purchase-order.query.port';
import {
  VENDOR_QUERY_PORT,
  VendorQueryPort,
} from '@business/vendor/ports/inbound/vendor.query.port';
import { VendorId } from '@business/vendor/domain/value-objects/vendor-id.vo';
import {
  PRODUCT_QUERY_PORT,
  ProductQueryPort,
} from '@business/product/ports/inbound/product.query.port';

/**
 * PurchaseOrder saga (process manager). Reacts to PurchaseOrderSubmitted and
 * orchestrates: validate vendor -> validate products -> approve or reject.
 * It talks to modules ONLY through their inbound ports/use cases — never
 * repositories or infrastructure.
 */
@Injectable()
export class PurchaseOrderSaga {
  private readonly logger = new Logger(PurchaseOrderSaga.name);
  private readonly approvalPolicy = PurchaseOrderApprovalPolicy.default();

  constructor(
    @Inject(PURCHASE_ORDER_COMMAND_PORT)
    private readonly purchaseOrderCommands: PurchaseOrderCommandPort,
    @Inject(PURCHASE_ORDER_QUERY_PORT)
    private readonly purchaseOrderQueries: PurchaseOrderQueryPort,
    @Inject(VENDOR_QUERY_PORT) private readonly vendorQuery: VendorQueryPort,
    @Inject(PRODUCT_QUERY_PORT) private readonly productQuery: ProductQueryPort,
  ) {}

  @OnEvent(PurchaseOrderSubmitted.name, { async: false })
  async handleSubmitted(event: PurchaseOrderSubmitted): Promise<void> {
    try {
      const id = event.purchaseOrderId.toString();

      const order = await this.purchaseOrderQueries.getPurchaseOrder(event.purchaseOrderId);
      if (!order) {
        await this.purchaseOrderCommands.reject({ id, reason: 'Purchase order not found' });
        return;
      }

      // Validate vendor through the Vendor module's inbound port.
      const vendor = await this.vendorQuery.getOrderableVendor(VendorId.fromString(event.vendorId));
      if (!vendor) {
        await this.purchaseOrderCommands.reject({
          id,
          reason: `Vendor ${event.vendorId} is not orderable`,
        });
        return;
      }

      // Validate each line's product through the Product module's inbound port.
      const purchasableProducts = await this.productQuery.getPurchasableProducts(
        order.lines.map(line => line.productId),
      );
      const purchasableIds = new Set(purchasableProducts.map(product => product.id));
      for (const line of order.lines) {
        if (!purchasableIds.has(line.productId)) {
          await this.purchaseOrderCommands.reject({
            id,
            reason: `Product ${line.productId} is not purchasable`,
          });
          return;
        }
      }

      const decision = this.approvalPolicy.evaluate({
        status: order.status as PurchaseOrderStatus,
        totalAmount: order.total,
      });

      if (!decision.ok) {
        await this.purchaseOrderCommands.reject({ id, reason: decision.error });
        this.logger.log(`Purchase order ${order.orderNumber} rejected by saga: ${decision.error}`);
      } else if (decision.value.requiresManualApproval) {
        this.logger.log(
          `Purchase order ${order.orderNumber} requires manual approval (amount ${order.total})`,
        );
      } else {
        await this.purchaseOrderCommands.approve({ id });
        this.logger.log(`Purchase order ${order.orderNumber} approved by saga`);
      }
    } catch (err) {
      this.logger.error(
        `Saga failed for purchase order ${event.purchaseOrderId.toString()}: ${(err as Error).message}`,
      );
    }
  }
}
