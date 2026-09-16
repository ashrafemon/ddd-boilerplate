import { Injectable } from '@nestjs/common';
import { KeyedRegistryBase } from '@shared-kernel/utils/keyed-registry.base';
import { DuplicateWebhookEventTypeRegistrationError } from './webhook.errors';

/**
 * In-memory allowlist of eventTypes a webhook subscription may declare —
 * populated once at boot from `WEBHOOK_EVENT_TYPES` in
 * `src/bootstrap/configure-webhooks.ts` (same precedent as
 * `ChannelProviderRegistry`). Governs both subscription creation
 * (create-webhook-subscription.usecase.ts rejects unknown eventTypes) and
 * the outbound dispatcher (webhook-dispatch.dispatcher.ts ignores domain
 * events whose name isn't on this list, so it never queries the DB for
 * something no subscription could ever declare).
 */
@Injectable()
export class WebhookEventTypeRegistry extends KeyedRegistryBase<true> {
  register(eventType: string): void {
    this.registerEntry(
      eventType,
      true,
      () => new DuplicateWebhookEventTypeRegistrationError(eventType),
    );
  }

  health(): string[] {
    return this.registeredKeys();
  }
}
