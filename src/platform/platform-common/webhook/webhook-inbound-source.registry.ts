import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { KeyedRegistryBase } from '@platform/platform-common/registry/keyed-registry';
import { WebhookInboundHandlerPort } from './ports/webhook-inbound-handler.port';
import { WebhookSignatureVerifier } from './webhook.types';

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
      () =>
        new ConflictException(`WebhookInboundHandler for source '${source}' already registered`),
    );
  }

  resolve(source: string): WebhookInboundSourceEntry {
    return this.requireEntry(
      source,
      () => new NotFoundException(`No WebhookInboundHandler registered for source '${source}'`),
    );
  }

  health(): string[] {
    return this.registeredKeys();
  }
}
