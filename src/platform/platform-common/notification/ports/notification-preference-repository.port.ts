import {
  NotificationPreferenceRecord,
  UpsertNotificationPreferenceInput,
} from '../notification.types';

/**
 * Persistence of notification_preferences — the consent half of the gate.
 * Read at fan-out (2.4); a missing row means the platform default (opted in)
 * applies.
 */
export abstract class NotificationPreferenceRepositoryPort {
  abstract findForRecipient(
    tenantId: string | undefined,
    recipientRef: string,
  ): Promise<NotificationPreferenceRecord[]>;

  abstract upsert(input: UpsertNotificationPreferenceInput): Promise<NotificationPreferenceRecord>;
}
