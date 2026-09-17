import { NotificationSuppressionRecord } from '../notification.types';

/**
 * Persistence of notification_suppressions — the compliance half of the
 * gate. Read at fan-out (2.5) and written by delivery receipts (6.4). Never
 * purged on the normal retention schedule.
 */
export abstract class NotificationSuppressionRepositoryPort {
  abstract isSuppressed(
    tenantId: string | undefined,
    address: string,
    channel: string,
  ): Promise<boolean>;

  abstract suppress(
    tenantId: string | undefined,
    address: string,
    channel: string,
    reason: string,
    source?: string,
  ): Promise<NotificationSuppressionRecord>;
}
