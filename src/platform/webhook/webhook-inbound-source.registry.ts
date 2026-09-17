import { Injectable } from '@nestjs/common';
import { KeyedRegistryBase } from '@shared-kernel/utils/keyed-registry.base';
import { WebhookInboundHandlerPort } from './ports/webhook-inbound-handler.port';
import { WebhookSignatureVerifier } from './webhook.types';
import {
  DuplicateWebhookInboundSourceRegistrationError,
  UnregisteredWebhookInboundSourceError,
} from './webhook.errors';

export interface WebhookInboundSourceEntry {
  verify: WebhookSignatureVerifier;
  handler: WebhookInboundHandlerPort;
}

/**
 * Map<source, {verify, handler}> populated at boot from
 * `WEBHOOK_INBOUND_SOURCES` in `src/bootstrap/configure-webhooks.ts` — same
 * composition-root bridge shape as `NotificationHandlerRegistry`. Starts
 * empty; ships ahead of consumers (PLATFORM-SERVICE-GUIDE §6).
 */
@Injectable()
export class WebhookInboundSourceRegistry extends KeyedRegistryBase<WebhookInboundSourceEntry> {
  register(source: string, entry: WebhookInboundSourceEntry): void {
    this.registerEntry(
      source,
      entry,
      () => new DuplicateWebhookInboundSourceRegistrationError(source),
    );
  }

  resolve(source: string): WebhookInboundSourceEntry {
    return this.requireEntry(source, () => new UnregisteredWebhookInboundSourceError(source));
  }

  health(): string[] {
    return this.registeredKeys();
  }
}
