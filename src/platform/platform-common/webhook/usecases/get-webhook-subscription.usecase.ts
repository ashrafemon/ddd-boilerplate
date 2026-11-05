import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantScope } from '@shared-kernel/utils/tenant-scope.util';
import { WebhookSubscriptionRepositoryPort } from '../ports/webhook-subscription-repository.port';
import { WebhookSubscriptionRecord } from '../webhook.types';

@Injectable()
export class GetWebhookSubscriptionUseCase {
  constructor(private readonly subscriptions: WebhookSubscriptionRepositoryPort) {}

  async execute(id: string, tenantId?: string): Promise<WebhookSubscriptionRecord> {
    const existing = await this.subscriptions.findById(id);
    if (!existing) {
      throw new NotFoundException(`WebhookSubscription '${id}' not found`);
    }
    TenantScope.assertVisible(existing.tenantId, tenantId);
    return existing;
  }
}
