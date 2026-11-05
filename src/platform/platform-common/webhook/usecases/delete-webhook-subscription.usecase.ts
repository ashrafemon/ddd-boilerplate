import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantScope } from '@shared-kernel/utils/tenant-scope.util';
import { WebhookSubscriptionRepositoryPort } from '../ports/webhook-subscription-repository.port';

@Injectable()
export class DeleteWebhookSubscriptionUseCase {
  constructor(private readonly subscriptions: WebhookSubscriptionRepositoryPort) {}

  async execute(id: string, tenantId?: string): Promise<void> {
    const existing = await this.subscriptions.findById(id);
    if (!existing) {
      throw new NotFoundException(`WebhookSubscription '${id}' not found`);
    }
    TenantScope.assertVisible(existing.tenantId, tenantId);
    await this.subscriptions.delete(id);
  }
}
