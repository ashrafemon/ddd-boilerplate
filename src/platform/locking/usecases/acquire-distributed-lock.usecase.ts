import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { RedisLockPort } from '../ports/redis-lock.port';
import { DistributedLockRepositoryPort } from '../ports/distributed-lock-repository.port';
import { LockKeyBuilder } from '../lock-key.builder';
import { DistributedLockAcquireRequest, DistributedLockAcquireResult } from '../locking.types';

const DEFAULT_LEASE_MS = 30_000;

/**
 * Use case: acquire a distributed lock.
 *
 * 1. Build the lock key from identity
 * 2. Generate fencing token from PostgreSQL
 * 3. Attempt Redis SET NX PX
 * 4. Return ACQUIRED with ticket or BUSY
 */
@Injectable()
export class AcquireDistributedLockUseCase {
  constructor(
    private readonly redisLock: RedisLockPort,
    private readonly repository: DistributedLockRepositoryPort,
    private readonly keyBuilder: LockKeyBuilder,
  ) {}

  async execute(request: DistributedLockAcquireRequest): Promise<DistributedLockAcquireResult> {
    const identity = {
      tenantId: request.tenantId,
      organizationId: request.organizationId,
      scope: request.scope,
      resource: request.resource,
    };

    const lockKey = this.keyBuilder.build(identity);
    const leaseMs = request.leaseMs ?? DEFAULT_LEASE_MS;
    const ownerToken = randomUUID();

    // Get next fencing token from PostgreSQL (atomic increment)
    const fencingToken = await this.repository.nextFencingToken(identity);

    // Try to acquire in Redis
    const acquired = await this.redisLock.acquire(lockKey, ownerToken, leaseMs);

    if (!acquired) {
      return { status: 'BUSY', retryAfterMs: leaseMs };
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + leaseMs);

    // Get or create the lock record for the lockId
    const record = await this.repository.getOrCreate(identity);

    return {
      status: 'ACQUIRED',
      ticket: {
        lockId: record.id,
        lockKey,
        ownerToken,
        fencingToken,
        acquiredAt: now,
        expiresAt,
      },
    };
  }
}
