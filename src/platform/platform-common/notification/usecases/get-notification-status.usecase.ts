import { Injectable } from '@nestjs/common';
import { NotificationRequestRepositoryPort } from '../ports/notification-request-repository.port';
import { NotificationRequestNotFoundError } from '../notification.errors';
import { NotificationMessageRecord, NotificationRequestRecord } from '../notification.types';

@Injectable()
export class GetNotificationStatusUseCase {
  constructor(private readonly requests: NotificationRequestRepositoryPort) {}

  async execute(
    requestId: string,
  ): Promise<{ request: NotificationRequestRecord; messages: NotificationMessageRecord[] }> {
    const result = await this.requests.findWithMessages(requestId);
    if (!result) {
      throw new NotificationRequestNotFoundError(requestId);
    }
    return result;
  }
}
