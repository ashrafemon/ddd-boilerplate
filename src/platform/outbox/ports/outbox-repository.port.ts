import {
  AppendOutboxEventRequest,
  ClaimOutboxOptions,
  OutboxClaimedRecord,
  OutboxMessage,
} from '../outbox.types';

/**
 * Internal repository port for the outbox persistence boundary.
 *
 * Business modules consume `OutboxPort`, not this port.
 * This port is internal to the Outbox module — used by use cases and the dispatcher.
 */
export abstract class OutboxRepositoryPort {
  /** Persist a single outbox event. Must run inside the caller's transaction. */
  abstract append(request: AppendOutboxEventRequest): Promise<OutboxMessage>;

  /** Persist a batch of outbox events. Must run inside the caller's transaction. */
  abstract appendMany(requests: AppendOutboxEventRequest[]): Promise<OutboxMessage[]>;

  /**
   * Race-safe claim: FOR UPDATE SKIP LOCKED over due PENDING/FAILED rows.
   * Stamps CLAIMED + claimToken + claimedAt and bumps attempts.
   */
  abstract claimBatch(options: ClaimOutboxOptions): Promise<OutboxClaimedRecord[]>;

  /** CAS update: CLAIMED → PUBLISHED. Only succeeds if claimToken matches. */
  abstract markPublished(id: string, claimToken: string): Promise<void>;

  /** CAS update: CLAIMED → FAILED (or DEAD_LETTER if attempts >= maxAttempts). */
  abstract markFailed(
    id: string,
    claimToken: string,
    error: string,
    availableAt: Date,
    maxAttempts: number,
  ): Promise<void>;

  /** Release expired CLAIMED rows back to PENDING. Returns affected count. */
  abstract releaseExpiredClaims(now: Date): Promise<number>;

  /** Delete old PUBLISHED rows. Returns deleted count. */
  abstract deletePublishedOlderThan(hours: number): Promise<number>;
}
