/**
 * Idempotency types — logical identity, requests, results, and reservation.
 */

/** Logical identity for an idempotency key. */
export interface IdempotencyIdentity {
  tenantId: string;
  organizationId: string;
  scope: string;
  key: string;
}

/** Request to reserve an idempotency key. */
export interface IdempotencyReserveRequest {
  tenantId: string;
  organizationId: string;
  scope: string;
  key: string;
  requestHash?: string;
  ttlMs?: number;
}

/** Opaque proof of ownership — required for complete/fail. */
export interface IdempotencyReservation {
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
      status: 'IN_PROGRESS';
    }
  | {
      status: 'SUSPENDED';
    }
  | {
      status: 'KEY_REUSED';
    };

/** Request to mark an idempotency key as completed. */
export interface IdempotencyCompleteRequest {
  reservation: IdempotencyReservation;
  result: unknown;
}

/** Request to mark an idempotency key as failed. */
export interface IdempotencyFailRequest {
  reservation: IdempotencyReservation;
  errorCode?: string;
  errorMessage?: string;
}

/** Idempotency configuration. */
export interface IIdempotencyConfig {
  ttlMs: number;
  claimLeaseMs: number;
  reconciliationIntervalMs: number;
}
