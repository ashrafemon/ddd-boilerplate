import { INestApplicationContext, Type } from '@nestjs/common';
import { WebhookEventTypeRegistry } from '@platform/webhook/webhook-event-type.registry';
import { WebhookInboundSourceRegistry } from '@platform/webhook/webhook-inbound-source.registry';
import { WebhookInboundHandlerPort } from '@platform/webhook/ports/webhook-inbound-handler.port';
import { WebhookSignatureVerifier } from '@platform/webhook/webhook.types';

/**
 * Composition-root bridge for the webhook opt-ins — same precedent as
 * `configure-notifications.ts` / `configure-batch-operations.ts`.
 *
 * Two independent lists:
 *  - WEBHOOK_EVENT_TYPES: outbox event class names a WebhookSubscription may
 *    declare interest in. A business module opts an event in by adding its
 *    name here — no adapter class needed, since outbound delivery forwards
 *    the event's own JSON snapshot verbatim (zero @business knowledge).
 *  - WEBHOOK_INBOUND_SOURCES: per-source signature verifier + a PURE
 *    WebhookInboundHandlerPort provider (no lifecycle, no registry import —
 *    same shape as notification's NotificationHandler opt-in).
 *
 * Both start EMPTY — no business module needs webhooks yet. Ships ahead of
 * consumers, same precedent as CachePort/EmailPort (PLATFORM-SERVICE-GUIDE §6).
 */
export const WEBHOOK_EVENT_TYPES: readonly string[] = [];

export interface WebhookInboundSourceOptIn {
  source: string;
  verify: WebhookSignatureVerifier;
  ownerModule: Type<unknown>;
  inboundHandler: Type<WebhookInboundHandlerPort>;
}

export const WEBHOOK_INBOUND_SOURCES: readonly WebhookInboundSourceOptIn[] = [];

export function configureWebhooks(
  app: INestApplicationContext,
  eventTypes: readonly string[] = WEBHOOK_EVENT_TYPES,
  inboundSources: readonly WebhookInboundSourceOptIn[] = WEBHOOK_INBOUND_SOURCES,
): void {
  const eventTypeRegistry = app.get(WebhookEventTypeRegistry);
  for (const eventType of eventTypes) {
    eventTypeRegistry.register(eventType);
  }

  const inboundRegistry = app.get(WebhookInboundSourceRegistry);
  for (const { source, verify, ownerModule, inboundHandler } of inboundSources) {
    inboundRegistry.register(source, {
      verify,
      handler: app.select(ownerModule).get(inboundHandler, { strict: true }),
    });
  }
}
