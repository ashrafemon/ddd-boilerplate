import { Injectable } from '@nestjs/common';
import { PageResult } from '@common/application/types/pagination';
import { NotificationRequestRepositoryPort } from '../ports/notification-request-repository.port';
import { NotificationListQuery, NotificationRequestRecord } from '../notification.types';

@Injectable()
export class ListNotificationsUseCase {
  constructor(private readonly requests: NotificationRequestRepositoryPort) {}

  async execute(query: NotificationListQuery): Promise<PageResult<NotificationRequestRecord>> {
    return this.requests.list(query);
  }
}
