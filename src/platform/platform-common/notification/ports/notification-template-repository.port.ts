import { NotificationTemplateVersion } from '../notification.types';

/**
 * Persistence of notification_templates. Resolution prefers a tenant-specific
 * row over the platform default (tenantId = null) for the same
 * (notificationType, channel, locale).
 */
export abstract class NotificationTemplateRepositoryPort {
  abstract resolveActive(
    tenantId: string | undefined,
    notificationType: string,
    channel: string,
    locale: string,
  ): Promise<NotificationTemplateVersion | null>;

  /** Boot-time validation: does at least one active version exist for this triple? */
  abstract existsActive(notificationType: string, channel: string): Promise<boolean>;
}
