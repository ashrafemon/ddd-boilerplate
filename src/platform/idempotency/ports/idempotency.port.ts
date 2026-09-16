/** Reservation outcome of an idempotency claim attempt. */
export type IdempotencyReservation =
  /** We own the key: run the operation, then markCompleted/markFailed. */
  | { status: 'ACQUIRED' }
  /** A previous attempt COMPLETED: return `result` verbatim (replay). */
  | { status: 'REPLAY'; result: unknown }
  /** Another attempt is in flight (or the row is stuck IN_PROGRESS pre-expiry): retry later. */
  | { status: 'IN_PROGRESS' };

export interface IdempotencyRef {
  scope: string;
  key: string;
  tenantId?: string;
}

/**
 * Cross-request / cross-replica duplicate-suppression ledger
 * (`platform/idempotency`, DB-backed — unlike `platform/locking` this must
 * survive Redis loss because it stores outcomes, not leases).
 *
 * Semantics: INSERT-as-claim on (scope, tenantId, key). COMPLETED replays the
 * stored result; FAILED / expired IN_PROGRESS may be re-acquired. Always
 * `markCompleted` with the response body to make replays faithful.
 */
export abstract class IdempotencyPort {
  abstract reserve(
    ref: IdempotencyRef,
    options?: { ttlMs?: number },
  ): Promise<IdempotencyReservation>;

  abstract markCompleted(ref: IdempotencyRef, result?: unknown): Promise<void>;

  /** Lets a legitimate retry re-acquire immediately instead of after TTL. */
  abstract markFailed(ref: IdempotencyRef): Promise<void>;

  /** Drops expired rows; returns deleted count (reconcile cron). */
  abstract purgeExpired(): Promise<number>;
}
