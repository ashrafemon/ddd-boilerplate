import {
  IdempotencyCompleteRequest,
  IdempotencyFailRequest,
  IdempotencyReserveRequest,
  IdempotencyReserveResult,
} from '../idempotency.types';

/**
 * Cross-request / cross-replica duplicate-suppression ledger
 * (`platform/idempotency`, DB-backed — unlike `platform/locking` this must
 * survive Redis loss because it stores outcomes, not leases).
 *
 * Business modules inject this port and control the sequence:
 * 1. reserve()
 * 2. execute business operation
 * 3. complete()
 *
 * Failure sequence:
 * 1. reserve()
 * 2. execute business operation
 * 3. fail()
 *
 * Replay sequence:
 * 1. reserve()
 * 2. REPLAY — return stored result
 */
export abstract class IdempotencyPort {
  /** Try to reserve an idempotency key. Returns ACQUIRED/REPLAY/IN_PROGRESS/SUSPENDED/KEY_REUSED. */
  abstract reserve(request: IdempotencyReserveRequest): Promise<IdempotencyReserveResult>;

  /** Mark the reservation as COMPLETED with the result for replay. */
  abstract complete(request: IdempotencyCompleteRequest): Promise<void>;

  /** Mark the reservation as FAILED — allows retry. */
  abstract fail(request: IdempotencyFailRequest): Promise<void>;
}
