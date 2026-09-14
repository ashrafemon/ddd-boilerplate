import { IntegrationMessage } from '@platform/messaging/ports/message-publisher.port';

export interface OutboxMessageRecord {
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  tenantId: string | null;
  payload: Record<string, unknown>;
  headers: Record<string, string> | null;
  occurredAt: Date;
  publishedAt: Date | null;
  attempts: number;
  lastError: string | null;
  status: 'PENDING' | 'PUBLISHING' | 'PUBLISHED' | 'FAILED' | 'DEAD_LETTER';
}

/** Outbound repository port (abstract class = DI token). */
export abstract class OutboxRepository {
  abstract save(message: IntegrationMessage): Promise<void>;

  /**
   * Race-safe claim: FOR UPDATE SKIP LOCKED over due PENDING/FAILED rows,
   * `PUBLISHING` + `claimedAt` lease stamped, `attempts` incremented here so
   * a claim-then-crash cycle still converges to the max-attempt bound.
   */
  abstract claimBatch(batchSize: number, maxAttempts: number): Promise<OutboxMessageRecord[]>;

  abstract markPublished(id: string): Promise<void>;

  /**
   * Records a publish failure: FAILED with exponential `nextRetryAt` backoff,
   * or DEAD_LETTER once the claimed `attempts` reached `maxAttempts`.
   */
  abstract markFailed(
    id: string,
    error: string,
    retry: { maxAttempts: number; backoffBaseMs: number },
  ): Promise<void>;

  /** Returns expired-lease PUBLISHING rows to PENDING; returns affected count. */
  abstract reconcileStaleClaims(leaseMs: number): Promise<number>;

  abstract deletePublishedOlderThan(hours: number): Promise<number>;
}
