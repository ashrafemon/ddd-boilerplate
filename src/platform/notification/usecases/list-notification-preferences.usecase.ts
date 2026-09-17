import { Injectable } from '@nestjs/common';
import { NotificationPreferenceRepositoryPort } from '../ports/notification-preference-repository.port';
import { NotificationPreferenceRecord } from '../notification.types';

@Injectable()
export class ListNotificationPreferencesUseCase {
  constructor(private readonly preferences: NotificationPreferenceRepositoryPort) {}

  async execute(
    tenantId: string | undefined,
    recipientRef: string,
  ): Promise<NotificationPreferenceRecord[]> {
    return this.preferences.findForRecipient(tenantId, recipientRef);
  }
}
