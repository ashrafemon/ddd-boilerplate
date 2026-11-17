import 'reflect-metadata';
import type { NotificationPriority } from './notification.types';

/**
 * Declares a business adapter as a notification handler for one
 * notificationType. Stackable — one adapter may serve several
 * notificationTypes (e.g. PurchaseOrderApproved + PurchaseOrderIssued).
 * `eventName` wires the EVENT-trigger path (NotificationEventDispatcher);
 * a duplicate notificationType still throws at registration (boot).
 */
export const NOTIFICATION_OPT_IN_METADATA = 'notification-opt-in';

export interface NotificationOptInMeta {
  notificationType: string;
  channels: string[];
  priority: NotificationPriority;
  /** Auto-fires this notificationType when a domain event of this name is published. */
  eventName?: string;
}

export const NotificationOptIn = (meta: NotificationOptInMeta): ClassDecorator => {
  return (target: object) => {
    const existing =
      (Reflect.getMetadata(NOTIFICATION_OPT_IN_METADATA, target) as
        NotificationOptInMeta[] | undefined) ?? [];
    Reflect.defineMetadata(NOTIFICATION_OPT_IN_METADATA, [...existing, meta], target);
  };
};
