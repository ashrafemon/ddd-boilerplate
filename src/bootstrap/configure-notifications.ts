import { INestApplicationContext, Type } from '@nestjs/common';
import { NotificationHandlerRegistry } from '@platform/notification/notification-handler.registry';
import { NotificationHandler } from '@platform/notification/ports/notification-handler.port';
import { NotificationPriority } from '@platform/notification/notification.types';
import { PurchaseOrderModule } from '@business/procurement/purchase-order/purchase-order.module';
import { PurchaseOrderNotificationAdapter } from '@business/procurement/purchase-order/infrastructure/adapters/platform/purchase-order-notification.adapter';

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
