import {
  IdempotencyIdentity,
  IdempotencyReservation,
  IdempotencyReserveResult,
} from '../idempotency.types';

/**
 * Repository port for persistent idempotency metadata in PostgreSQL.
 * Maintains the claim token, version, and state transitions.
 */
export abstract class IdempotencyRepositoryPort {
  /** Find an existing idempotency key by identity. */
  abstract findUnique(
    identity: IdempotencyIdentity,
  ): Promise<{
    id: string;
    status: string;
    claimToken: string;
    version: number;
    resultJson: unknown;
    requestHash: string | null;
    claimedAt: Date | null;
    expiresAt: Date;
  } | null>;

  /** Insert a new IN_PROGRESS row with claim token and version. */
  abstract insert(
    identity: IdempotencyIdentity,
    claimToken: string,
    expiresAt: Date,
    requestHash?: string,
  ): Promise<{ id: string; version: number }>;

  /** Atomic takeover of FAILED/SUSPENDED/expired rows. Returns true if taken over. */
  abstract takeover(
    identity: IdempotencyIdentity,
    claimToken: string,
    expiresAt: Date,
  ): Promise<boolean>;

  /** CAS update: IN_PROGRESS → COMPLETED. Returns true if ownership valid. */
  abstract complete(
    id: string,
    claimToken: string,
    version: number,
    result: unknown,
  ): Promise<boolean>;

  /** CAS update: IN_PROGRESS → FAILED. Returns true if ownership valid. */
  abstract fail(
    id: string,
    claimToken: string,
    version: number,
    errorCode?: string,
    errorMessage?: string,
  ): Promise<boolean>;

  /** Transition expired IN_PROGRESS rows to SUSPENDED. */
  abstract suspendExpiredClaims(claimLeaseMs: number): Promise<number>;

  /** Delete expired rows (any status past expires_at). */
  abstract purgeExpired(): Promise<number>;
}
