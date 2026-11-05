import { Injectable } from '@nestjs/common';
import { PageResult } from '@shared-kernel/types/pagination';
import { WebhookSubscriptionRepositoryPort } from '../ports/webhook-subscription-repository.port';
import { WebhookSubscriptionQuery, WebhookSubscriptionRecord } from '../webhook.types';

@Injectable()
export class ListWebhookSubscriptionsUseCase {
  constructor(private readonly subscriptions: WebhookSubscriptionRepositoryPort) {}

  async execute(query: WebhookSubscriptionQuery): Promise<PageResult<WebhookSubscriptionRecord>> {
    return this.subscriptions.list(query);
  }
}
