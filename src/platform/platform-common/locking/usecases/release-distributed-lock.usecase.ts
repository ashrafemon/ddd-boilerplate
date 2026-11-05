import { Injectable } from '@nestjs/common';
import { RedisLockPort } from '../ports/redis-lock.port';
import { DistributedLockReleaseRequest } from '../locking.types';

/**
 * Use case: release a held distributed lock.
 *
 * Atomic ownership check + delete via Redis Lua script.
 * Best effort — releasing an already-expired lock is not an error.
 */
@Injectable()
export class ReleaseDistributedLockUseCase {
  constructor(private readonly redisLock: RedisLockPort) {}

  async execute(request: DistributedLockReleaseRequest): Promise<void> {
    await this.redisLock.release(request.ticket.lockKey, request.ticket.ownerToken);
  }
}
