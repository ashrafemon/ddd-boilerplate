import { DistributedLockIdentity, DistributedLockRecord } from '../locking.types';

/**
 * Repository port for persistent lock metadata in PostgreSQL.
 * Maintains the fencing token sequence per lock resource.
 */
export abstract class DistributedLockRepositoryPort {
  /** Get or create a lock record for the given identity. */
  abstract getOrCreate(identity: DistributedLockIdentity): Promise<DistributedLockRecord>;

  /** Atomically increment and return the next fencing token for the identity. */
  abstract nextFencingToken(identity: DistributedLockIdentity): Promise<number>;
}
