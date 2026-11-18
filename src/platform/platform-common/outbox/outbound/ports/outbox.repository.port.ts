import {
  AppendOutboxEventRequest,
  ClaimOutboxOptions,
  OutboxClaimedRecord,
  OutboxMessage,
} from '../../types/outbox.types';

/**
 * Outbound port: the transactional outbox ledger (PostgreSQL).
 *
 * Every write runs inside the caller's transaction or CLS scope, and every
 * state transition is CAS-fenced on `claimToken`, so a lease that was lost can
 * neither settle nor retry a row it no longer owns.
 *
 * The claim is the only concurrency-critical method: `FOR UPDATE SKIP LOCKED`
 * over due rows, stamping `status = PUBLISHING` together with `claim_token` and
 * `claimed_at` (the lease) and bumping `attempts`. A crashed owner stays
 * PUBLISHING and is reclaimed by the next tick once its lease expires — there
 * is no reconciler.
 */
export abstract class OutboxRepositoryPort {
  /** Insert one event in the caller's transaction. */
  abstract append(request: AppendOutboxEventRequest): Promise<OutboxMessage>;

  /** Claim up to `batchSize` due messages for this tick. */
  abstract claimBatch(options: ClaimOutboxOptions): Promise<OutboxClaimedRecord[]>;

  /** CAS settle: PENDING → PUBLISHED. A lost lease is a no-op. */
  abstract markPublished(id: string, claimToken: string): Promise<void>;

  /** CAS settle: back to PENDING with backoff, or DEAD_LETTER when exhausted. */
  abstract markFailed(
    id: string,
    claimToken: string,
    error: string,
    availableAt: Date,
    maxAttempts: number,
  ): Promise<void>;

  /**
   * CAS settle: park FAILED for a permanent error (missing broker
   * configuration). The row is out of the retry loop but not a poison message,
   * so an operator can fix configuration and re-queue it.
   */
  abstract markPermanentlyFailed(id: string, claimToken: string, error: string): Promise<void>;

  /** Retention sweep for PUBLISHED rows. Returns the deleted count. */
  abstract deletePublishedOlderThan(hours: number): Promise<number>;
}
