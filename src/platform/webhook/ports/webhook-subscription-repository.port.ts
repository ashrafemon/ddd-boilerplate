import { PageResult } from '@shared-kernel/types/pagination';
import {
  NewWebhookSubscription,
  UpdateWebhookSubscriptionInput,
  WebhookSubscriptionQuery,
  WebhookSubscriptionRecord,
} from '../webhook.types';

export abstract class WebhookSubscriptionRepositoryPort {
  abstract create(input: NewWebhookSubscription): Promise<WebhookSubscriptionRecord>;

  abstract findById(id: string): Promise<WebhookSubscriptionRecord | null>;

  /** Active subscriptions declaring `eventType` — dispatch-webhook-event's fan-out source. */
  abstract findActiveByEventType(eventType: string): Promise<WebhookSubscriptionRecord[]>;

  abstract list(query: WebhookSubscriptionQuery): Promise<PageResult<WebhookSubscriptionRecord>>;

  abstract update(
    id: string,
    input: UpdateWebhookSubscriptionInput,
  ): Promise<WebhookSubscriptionRecord>;

  abstract delete(id: string): Promise<void>;

  /**
   * Bumps/clears the consecutive-failure counter and last success/failure
   * timestamps. Returns the updated record so the caller can check the
   * circuit-breaker threshold without a second read.
   */
  abstract recordDeliveryOutcome(
    id: string,
    outcome: { success: boolean },
  ): Promise<WebhookSubscriptionRecord>;
}
