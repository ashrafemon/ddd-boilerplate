import {
  IdempotencyCompletedView,
  IdempotencyIdentity,
  IdempotencyReservation,
  IdempotencyRowView,
} from '../../types/idempotency.types';

/**
 * Outbound port: the durable idempotency ledger (PostgreSQL).
 *
 * Use cases depend on this port, never on the Prisma adapter. Every state
 * transition is a compare-and-set, so a retried or duplicated caller can never
 * win twice:
 *   insert-as-claim on the unique identity
 *   takeover only after the claim's `leaseUntil` has passed
 *   complete on id + claimToken + version + IN_PROGRESS
 *   fail deletes that same guarded row
 */
export abstract class IdempotencyRepositoryPort {
  abstract findByIdentity(identity: IdempotencyIdentity): Promise<IdempotencyRowView | null>;

  abstract insertClaim(
    identity: IdempotencyIdentity,
    claimToken: string,
    expiresAt: Date,
    leaseUntil: Date,
    requestHash?: string,
  ): Promise<{ id: string; version: number }>;

  abstract takeoverExpiredClaim(
    identity: IdempotencyIdentity,
    claimToken: string,
    expiresAt: Date,
    leaseUntil: Date,
    legacyClaimCutoff: Date,
  ): Promise<{ id: string; version: number } | null>;

  abstract completeCas(
    reservation: IdempotencyReservation,
    result: unknown,
  ): Promise<IdempotencyCompletedView | null>;

  abstract failDeleteCas(reservation: IdempotencyReservation): Promise<boolean>;

  /** Reconciliation: delete every row past its `expiresAt`. */
  abstract purgeExpired(now: Date): Promise<number>;
}
