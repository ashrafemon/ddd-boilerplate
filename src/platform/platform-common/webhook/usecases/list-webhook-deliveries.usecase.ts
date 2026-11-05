import { Injectable } from '@nestjs/common';
import { PageResult } from '@shared-kernel/types/pagination';
import { WebhookDeliveryRepositoryPort } from '../ports/webhook-delivery-repository.port';
import { WebhookDeliveryQuery, WebhookDeliveryRecord } from '../webhook.types';

@Injectable()
export class ListWebhookDeliveriesUseCase {
  constructor(private readonly deliveries: WebhookDeliveryRepositoryPort) {}

  async execute(query: WebhookDeliveryQuery): Promise<PageResult<WebhookDeliveryRecord>> {
    return this.deliveries.list(query);
  }
}
