import { InboundWebhookContext } from '../webhook.types';

/**
 * Business/platform-implemented inward surface for one inbound webhook
 * source (payment gateway, storage provider, ...). Registered via the
 * composition root (src/bootstrap/configure-webhooks.ts) — same precedent
 * as notification's `NotificationHandler`: a plain interface, not an
 * abstract class, since it is never DI-resolved by this module directly.
 */
export interface WebhookInboundHandlerPort {
  handle(payload: unknown, context: InboundWebhookContext): Promise<void>;
}
