import {
  IdempotencyCompleteRequest,
  IdempotencyFailRequest,
  IdempotencyReserveRequest,
  IdempotencyReserveResult,
} from '../idempotency.types';

export type {
  IdempotencyCompleteRequest,
  IdempotencyFailRequest,
  IdempotencyReserveRequest,
  IdempotencyReserveResult,
};

/**
 * Cross-request / cross-replica duplicate-suppression ledger
 * (`platform/idempotency`).
 *
 * Business modules inject this port and control the sequence:
 * 1. reserve() → ACQUIRED → run the operation → complete()
 * 2. reserve() → REPLAY  → return the stored result, run nothing
 * 3. reserve() → BUSY    → 409, retry later
 * 4. reserve() → KEY_MISMATCH → 400, the key belongs to another request
 *
 * On failure: reserve() → ACQUIRED → run → fail() releases the claim.
 */
export abstract class IdempotencyPort {
  abstract reserve(request: IdempotencyReserveRequest): Promise<IdempotencyReserveResult>;

  /** Mark the reservation COMPLETED and cache the result for replay. */
  abstract complete(request: IdempotencyCompleteRequest): Promise<void>;

  /** Release the claim: CAS-delete the row and evict the cached result. */
  abstract fail(request: IdempotencyFailRequest): Promise<void>;
}
