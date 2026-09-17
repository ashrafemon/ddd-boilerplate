import { registerAs } from '@nestjs/config';
import { numericEnv } from './env.util';

export type INotificationPipelineConfig = {
  /** Soft cap on recipients x channels per request — bounds one event's blast radius. */
  maxRecipientsPerRequest: number;
  /** <= this many messages AND priority=HIGH runs Sync; above/otherwise runs Async. */
  syncMessageThreshold: number;
  /** Messages per Async chunk. Redelivery only ever re-checks one chunk. */
  chunkSize: number;
  /** Async chunks processed in parallel per node. */
  workerConcurrency: number;
  /** BullMQ attempts per chunk before dead-letter / operator alert. */
  chunkAttempts: number;
  /** A render taking longer than this has a defect — fail the message, not the chunk. */
  renderTimeoutMs: number;
  /** A message stuck RENDERING longer than this is treated as an orphaned claim. */
  renderingStuckWindowMs: number;
  /** A message SENT with no delivery receipt longer than this is flagged for review. */
  sentNoReceiptWindowMs: number;
  /** The triggering event's snapshot larger than this is rejected — a summary, not a dump. */
  payloadMaxBytes: number;
  /** rendered_snapshot larger than this is dropped (a marker is stored instead). */
  renderedSnapshotMaxBytes: number;
};

/**
 * Notification pipeline config — selection limits, the Sync/Async threshold,
 * chunk sizing and the two reconciliation windows. Consumed only by
 * platform/notification; distinct from the `notification` config key, which
 * holds the SES/SNS credentials the channel providers use.
 */
export default registerAs('notificationPipeline', (): INotificationPipelineConfig => ({
  maxRecipientsPerRequest: numericEnv('NOTIFICATION_MAX_RECIPIENTS_PER_REQUEST', 10_000),
  syncMessageThreshold: numericEnv('NOTIFICATION_SYNC_MESSAGE_THRESHOLD', 5),
  chunkSize: numericEnv('NOTIFICATION_CHUNK_SIZE', 100),
  workerConcurrency: numericEnv('NOTIFICATION_WORKER_CONCURRENCY', 5),
  chunkAttempts: numericEnv('NOTIFICATION_CHUNK_ATTEMPTS', 3),
  renderTimeoutMs: numericEnv('NOTIFICATION_RENDER_TIMEOUT_MS', 2_000),
  renderingStuckWindowMs: numericEnv('NOTIFICATION_RENDERING_STUCK_WINDOW_MS', 600_000),
  sentNoReceiptWindowMs: numericEnv('NOTIFICATION_SENT_NO_RECEIPT_WINDOW_MS', 86_400_000),
  payloadMaxBytes: numericEnv('NOTIFICATION_PAYLOAD_MAX_BYTES', 65_536),
  renderedSnapshotMaxBytes: numericEnv('NOTIFICATION_RENDERED_SNAPSHOT_MAX_BYTES', 262_144),
}));
