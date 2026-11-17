import 'reflect-metadata';
import type { WebhookSignatureVerifier } from './webhook.types';

/**
 * Webhook opt-ins — both stackable class decorators.
 *
 * `@WebhookEventTypeOptIn(name)`: opts an outbox event class name in as a
 * subscribable webhook event type (outbound delivery forwards the event's
 * JSON snapshot verbatim — no adapter needed).
 *
 * `@WebhookInboundSourceOptIn({ source, verify })`: declares an inbound
 * webhook source with its signature verifier; the decorated class must
 * implement WebhookInboundHandlerPort.
 */
export const WEBHOOK_EVENT_TYPE_OPT_IN_METADATA = 'webhook-event-type-opt-in';
export const WEBHOOK_INBOUND_OPT_IN_METADATA = 'webhook-inbound-opt-in';

export interface WebhookInboundOptInMeta {
  source: string;
  verify: WebhookSignatureVerifier;
}

export const WebhookEventTypeOptIn = (eventType: string): ClassDecorator => {
  return (target: object) => {
    const existing =
      (Reflect.getMetadata(WEBHOOK_EVENT_TYPE_OPT_IN_METADATA, target) as string[] | undefined) ??
      [];
    Reflect.defineMetadata(WEBHOOK_EVENT_TYPE_OPT_IN_METADATA, [...existing, eventType], target);
  };
};

export const WebhookInboundSourceOptIn = (meta: WebhookInboundOptInMeta): ClassDecorator => {
  return (target: object) => {
    const existing =
      (Reflect.getMetadata(WEBHOOK_INBOUND_OPT_IN_METADATA, target) as
        WebhookInboundOptInMeta[] | undefined) ?? [];
    Reflect.defineMetadata(WEBHOOK_INBOUND_OPT_IN_METADATA, [...existing, meta], target);
  };
};
