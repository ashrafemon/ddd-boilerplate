import { InboxIdentity, InboxMessage } from '../../types/inbox.types';

/** Values needed to open a claim for a first delivery. */
export interface InsertInboxMessageInput {
  identity: InboxIdentity;
  messageType: string;
  eventVersion: number;
  payload: unknown;
  payloadHash: string;
  headers: Record<string, string> | null;
  claimToken: string;
  claimedAt: Date;
  correlationId: string | null;
  causationId: string | null;
}

/** Sweep inputs, resolved from configuration by the caller. */
export interface ReconcileInboxOptions {
  now: Date;
  claimLeaseMs: number;
  maxAttempts: number;
  retryBaseDelayMs: number;
  retryMaxDelayMs: number;
}

/**
 * Outbound port: the inbox deduplication ledger (PostgreSQL).
 *
 * `insertIfAbsent` is the exclusivity primitive — one `INSERT` on the unique
 * identity, a duplicate is a `null` (never read-then-write). Every later state
 * change is CAS-fenced on `claimToken`, so a redelivery that lost the race can
 * neither complete nor fail somebody else's claim.
 */
export abstract class InboxRepositoryPort {
  /** Insert-as-claim; `null` when the identity already exists. */
  abstract insertIfAbsent(input: InsertInboxMessageInput): Promise<{ id: string } | null>;

  /** Read the row for one identity. */
  abstract findUnique(identity: InboxIdentity): Promise<InboxMessage | null>;

  /** CAS re-claim of a due retry; only one racer wins on the previous token. */
  abstract reclaim(
    id: string,
    previousClaimToken: string,
    claimToken: string,
    now: Date,
  ): Promise<boolean>;

  /** CAS: IN_PROGRESS → PROCESSED. */
  abstract complete(id: string, claimToken: string): Promise<boolean>;

  /** CAS: back to IN_PROGRESS with an exponential `nextAttemptAt`. */
  abstract fail(
    id: string,
    claimToken: string,
    lastError: string | null,
    retryBaseDelayMs: number,
    retryMaxDelayMs: number,
  ): Promise<boolean>;

  /** CAS: park FAILED for a permanent error no redelivery can fix. */
  abstract markPermanentlyFailed(
    id: string,
    claimToken: string,
    lastError: string | null,
  ): Promise<boolean>;

  /** Park expired poison as SUSPENDED and give the rest a fresh backoff. */
  abstract reconcileExpiredClaims(options: ReconcileInboxOptions): Promise<number>;

  /** Delete PROCESSED rows past retention. */
  abstract deleteProcessedOlderThan(retentionMs: number): Promise<number>;
}
