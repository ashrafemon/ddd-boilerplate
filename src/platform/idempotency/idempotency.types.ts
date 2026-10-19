/**
 * Idempotency types — logical identity, requests, results, and reservation.
 *
 * Design `common/02-idempotency`: Postgres owns the claims, Redis only caches
 * COMPLETED results for fast replay. Result statuses are ACQUIRED / REPLAY /
 * BUSY / KEY_MISMATCH.
 */

/** Logical identity for an idempotency key. */
export interface IdempotencyIdentity {
  tenantId: string;
  organizationId: string;
  scope: string;
  key: string;
}

/** Request to reserve an idempotency key. */
export interface IdempotencyReserveRequest extends IdempotencyIdentity {
  requestHash?: string;
  ttlMs?: number;
}

/**
 * Opaque proof of ownership — required for complete/fail.
 *
 * It also carries the identity so complete/fail can build the Redis result
 * key without a second database round-trip.
 */
export interface IdempotencyReservation extends IdempotencyIdentity {
  id: string;
  claimToken: string;
  version: number;
}

/** Result of a reserve attempt. */
export type IdempotencyReserveResult =
  | {
      status: 'ACQUIRED';
      reservation: IdempotencyReservation;
    }
  | {
      status: 'REPLAY';
      result: unknown;
    }
  | {
      status: 'BUSY';
    }
  | {
      status: 'KEY_MISMATCH';
    };

/** Request to mark an idempotency key as completed. */
export interface IdempotencyCompleteRequest {
  reservation: IdempotencyReservation;
  result: unknown;
}

/** Request to release an idempotency claim (deletes the row). */
export interface IdempotencyFailRequest {
  reservation: IdempotencyReservation;
}

/** Idempotency configuration. */
export interface IIdempotencyConfig {
  /** Completed results replay for this long, then are purged. */
  ttlMs: number;
  /** Live-claim window before another reserve may take the row over. */
  claimLeaseMs: number;
  /** Hourly purge cadence (informational). */
  reconciliationIntervalMs: number;
  /** Redis key prefix for COMPLETED result replay. */
  redisPrefix: string;
}
