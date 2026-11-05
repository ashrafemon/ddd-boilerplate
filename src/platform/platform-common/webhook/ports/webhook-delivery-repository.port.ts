import { PageResult } from '@shared-kernel/types/pagination';
import { NewWebhookDelivery, WebhookDeliveryQuery, WebhookDeliveryRecord } from '../webhook.types';

export abstract class WebhookDeliveryRepositoryPort {
  /**
   * Idempotent on (subscriptionId, eventId) — a re-delivered outbox event
   * can't double-create delivery rows. Returns only the rows actually
   * created (skips ones that already existed).
   */
  abstract createMany(deliveries: NewWebhookDelivery[]): Promise<WebhookDeliveryRecord[]>;

  abstract findById(id: string): Promise<WebhookDeliveryRecord | null>;

  abstract list(query: WebhookDeliveryQuery): Promise<PageResult<WebhookDeliveryRecord>>;

  /**
   * CAS claim for the single delivery a BullMQ job names: PENDING ->
   * DELIVERING. Returns null if the row is missing or already claimed by
   * another (shouldn't happen given jobId=deliveryId dedupe + BullMQ's own
   * per-job lock, but the claim stays CAS-guarded regardless).
   */
  abstract claim(id: string): Promise<WebhookDeliveryRecord | null>;

  abstract markDelivered(id: string, responseCode: number): Promise<void>;

  /** DELIVERING -> PENDING (BullMQ owns the actual retry timing; nextAttemptAt is informational). */
  abstract markFailedForRetry(
    id: string,
    nextAttemptAt: Date,
    responseCode: number | null,
    error: string,
  ): Promise<void>;

  /** {PENDING|DELIVERING} -> DEAD_LETTER — called once BullMQ has exhausted its attempts. */
  abstract markDeadLettered(id: string, responseCode: number | null, error: string): Promise<void>;

  /**
   * Requeues deliveries claimed (DELIVERING) past the stuck window back to
   * PENDING — covers a worker process crashing mid-attempt, which leaves no
   * BullMQ retry to pick the row back up. Returns the reset ids so the
   * reconciliation cron can re-enqueue them (same two-step shape as
   * notification-reconciliation.consumer.ts's reset+re-dispatch).
   */
  abstract resetStuck(windowMs: number): Promise<string[]>;

  /**
   * Safety net alongside resetStuck: PENDING rows older than the window that
   * were never enqueued at all (process crash between createMany and
   * enqueueDelivery) — BullMQ's own retry never runs for a job that was
   * never created. Returns their ids so the reconciliation cron can
   * re-enqueue them; re-enqueuing an id whose job is still legitimately
   * in-flight is a harmless no-op (jobId = deliveryId dedupes).
   */
  abstract findStalePending(windowMs: number): Promise<string[]>;

  /** Admin manual retry: DEAD_LETTER -> PENDING. attemptCount is NOT reset. */
  abstract resetForRedelivery(id: string): Promise<WebhookDeliveryRecord>;
}
