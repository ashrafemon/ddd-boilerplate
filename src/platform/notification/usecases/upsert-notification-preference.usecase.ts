import { Injectable } from '@nestjs/common';
import { NotificationPreferenceRepositoryPort } from '../ports/notification-preference-repository.port';
import {
  NotificationPreferenceRecord,
  UpsertNotificationPreferenceInput,
} from '../notification.types';

/** Writes a recipient's own consent row — the only mutation path into the gate's data. */
@Injectable()
export class UpsertNotificationPreferenceUseCase {
  constructor(private readonly preferences: NotificationPreferenceRepositoryPort) {}

  async execute(input: UpsertNotificationPreferenceInput): Promise<NotificationPreferenceRecord> {
    return this.preferences.upsert(input);
  }
}
