import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantScope } from '@shared-kernel/utils/tenant-scope.util';
import { WebhookSubscriptionRepositoryPort } from '../ports/webhook-subscription-repository.port';
import { WebhookEventTypeRegistry } from '../webhook-event-type.registry';
import { UpdateWebhookSubscriptionInput, WebhookSubscriptionRecord } from '../webhook.types';
import { WebhookEventTypeNotAllowedError } from '../webhook.errors';

@Injectable()
export class UpdateWebhookSubscriptionUseCase {
  constructor(
    private readonly subscriptions: WebhookSubscriptionRepositoryPort,
    private readonly eventTypes: WebhookEventTypeRegistry,
  ) {}

  async execute(
    id: string,
    input: UpdateWebhookSubscriptionInput,
    tenantId?: string,
  ): Promise<WebhookSubscriptionRecord> {
    const existing = await this.subscriptions.findById(id);
    if (!existing) {
      throw new NotFoundException(`WebhookSubscription '${id}' not found`);
    }
    TenantScope.assertVisible(existing.tenantId, tenantId);
    for (const eventType of input.eventTypes ?? []) {
      if (!this.eventTypes.has(eventType)) {
        throw new WebhookEventTypeNotAllowedError(eventType);
      }
    }
    return this.subscriptions.update(id, input);
  }
}
