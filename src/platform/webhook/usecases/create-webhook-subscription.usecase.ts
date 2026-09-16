import { Injectable } from '@nestjs/common';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { WebhookSubscriptionRepositoryPort } from '../ports/webhook-subscription-repository.port';
import { WebhookEventTypeRegistry } from '../webhook-event-type.registry';
import { NewWebhookSubscription, WebhookSubscriptionRecord } from '../webhook.types';
import { WebhookEventTypeNotAllowedError } from '../webhook.errors';

export interface CreateWebhookSubscriptionInput {
  url: string;
  secret: string;
  eventTypes: string[];
  description?: string | null;
  tenantId?: string;
}

@Injectable()
export class CreateWebhookSubscriptionUseCase {
  constructor(
    private readonly subscriptions: WebhookSubscriptionRepositoryPort,
    private readonly eventTypes: WebhookEventTypeRegistry,
    private readonly requestContext: RequestContextPort,
  ) {}

  async execute(input: CreateWebhookSubscriptionInput): Promise<WebhookSubscriptionRecord> {
    for (const eventType of input.eventTypes) {
      if (!this.eventTypes.has(eventType)) {
        throw new WebhookEventTypeNotAllowedError(eventType);
      }
    }
    const tenantId = input.tenantId ?? this.requestContext.getTenantId();
    const data: NewWebhookSubscription = {
      tenantId: tenantId ?? null,
      url: input.url,
      secret: input.secret,
      eventTypes: input.eventTypes,
      description: input.description ?? null,
    };
    return this.subscriptions.create(data);
  }
}
