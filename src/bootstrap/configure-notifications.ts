import { INestApplicationContext, Type } from '@nestjs/common';
import { NotificationHandlerRegistry } from '@platform/notification/notification-handler.registry';
import { NotificationHandler } from '@platform/notification/ports/notification-handler.port';
import { NotificationPriority } from '@platform/notification/notification.types';
import { PurchaseOrderModule } from '@business/procurement/purchase-order/purchase-order.module';
import { PurchaseOrderNotificationAdapter } from '@business/procurement/purchase-order/infrastructure/adapters/platform/purchase-order-notification.adapter';
import { GoodReceiptNoteModule } from '@business/procurement/good-receipt-note/good-receipt-note.module';
import { GrnNotificationAdapter } from '@business/procurement/good-receipt-note/infrastructure/adapters/platform/grn-notification.adapter';

/**
 * Composition-root bridge for the notification opt-in — same precedent as
 * `configure-batch-operations.ts` / `configure-imports.ts`: business
 * handlers stay pure `NotificationHandler`s (no lifecycle, no registry
 * imports), owner modules stay bodyless `@Module`s, and only this file — the
 * layer allowed to know both sides — plugs business handlers into the
 * platform registry after modules are instantiated but before the server
 * listens. `eventName` wires the EVENT-trigger path (see
 * NotificationEventDispatcher); a duplicate notificationType still throws
 * at boot.
 */
export interface NotificationOptIn {
  notificationType: string;
  channels: string[];
  priority: NotificationPriority;
  /** Auto-fires this notificationType when a domain event of this name is published. */
  eventName?: string;
  ownerModule: Type<unknown>;
  notificationHandler: Type<NotificationHandler>;
}

export const NOTIFICATION_HANDLERS: readonly NotificationOptIn[] = [
  {
    notificationType: 'PurchaseOrderApproved',
    channels: ['EMAIL'],
    priority: 'NORMAL',
    eventName: 'PurchaseOrderApproved',
    ownerModule: PurchaseOrderModule,
    notificationHandler: PurchaseOrderNotificationAdapter,
  },
  // Plan Phase 6.2 / §1.8: issuing a PO notifies the vendor through the same
  // pure handler (payload-driven, vendor recipient + order model).
  {
    notificationType: 'PurchaseOrderIssued',
    channels: ['EMAIL'],
    priority: 'NORMAL',
    eventName: 'PurchaseOrderIssued',
    ownerModule: PurchaseOrderModule,
    notificationHandler: PurchaseOrderNotificationAdapter,
  },
  // Plan Phase 6.2 / §1.8: posting a GRN targets warehouse/receiving — the
  // recipient directory arrives with the deferred IAM build, so the handler
  // resolves no addresses yet (platform: NO_RECIPIENTS, not a failure).
  {
    notificationType: 'GoodsReceiptPosted',
    channels: ['EMAIL'],
    priority: 'NORMAL',
    eventName: 'GoodsReceiptPosted',
    ownerModule: GoodReceiptNoteModule,
    notificationHandler: GrnNotificationAdapter,
  },
];

/** Strict per-module lookup: fails loudly if a module stops providing its adapter. */
export function configureNotifications(
  app: INestApplicationContext,
  handlers: readonly NotificationOptIn[] = NOTIFICATION_HANDLERS,
): void {
  const registry = app.get(NotificationHandlerRegistry);
  for (const {
    notificationType,
    channels,
    priority,
    eventName,
    ownerModule,
    notificationHandler,
  } of handlers) {
    registry.register(
      { notificationType, channels, priority, eventName },
      app.select(ownerModule).get(notificationHandler, { strict: true }),
    );
  }
}
