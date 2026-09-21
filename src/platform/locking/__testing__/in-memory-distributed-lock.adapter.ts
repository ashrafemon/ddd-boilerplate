import { randomUUID } from 'crypto';
import { DistributedLockPort } from '../ports/distributed-lock.port';
import {
  DistributedLockAcquireRequest,
  DistributedLockAcquireResult,
  DistributedLockRenewRequest,
  DistributedLockRenewResult,
  DistributedLockReleaseRequest,
} from '../locking.types';

/**
 * In-memory distributed lock adapter for unit tests.
 *
 * Simulates Redis SET NX PX with an in-memory Map.
 * No PostgreSQL fencing tokens — just the lock semantics.
 */
export class InMemoryDistributedLockAdapter implements DistributedLockPort {
  private locks = new Map<string, { owner: string; expiresAt: number }>();
  private fencingTokens = new Map<string, number>();

  acquire(request: DistributedLockAcquireRequest): Promise<DistributedLockAcquireResult> {
    const key = [request.tenantId, request.organizationId, request.scope, request.resource].join(
      ':',
    );
    const leaseMs = request.leaseMs ?? 30_000;
    const now = Date.now();
    const existing = this.locks.get(key);

    // Clean up expired locks
    if (existing && existing.expiresAt <= now) {
      this.locks.delete(key);
    }

    if (this.locks.has(key)) {
      return Promise.resolve({ status: 'BUSY', retryAfterMs: leaseMs });
    }

    const ownerToken = randomUUID();
    const currentFencing = (this.fencingTokens.get(key) ?? 0) + 1;
    this.fencingTokens.set(key, currentFencing);
    this.locks.set(key, { owner: ownerToken, expiresAt: now + leaseMs });

    return Promise.resolve({
      status: 'ACQUIRED',
      ticket: {
        lockId: randomUUID(),
        lockKey: key,
        ownerToken,
        fencingToken: currentFencing,
        acquiredAt: new Date(now),
        expiresAt: new Date(now + leaseMs),
      },
    });
  }

  renew(request: DistributedLockRenewRequest): Promise<DistributedLockRenewResult> {
    const existing = this.locks.get(request.ticket.lockKey);

    if (!existing || existing.owner !== request.ticket.ownerToken) {
      return Promise.resolve({ status: 'LOST' });
    }

    const leaseMs = request.leaseMs ?? 30_000;
    const now = Date.now();
    this.locks.set(request.ticket.lockKey, {
      ...existing,
      expiresAt: now + leaseMs,
    });

    return Promise.resolve({
      status: 'RENEWED',
      ticket: {
        ...request.ticket,
        expiresAt: new Date(now + leaseMs),
      },
    });
  }

  release(request: DistributedLockReleaseRequest): Promise<void> {
    const existing = this.locks.get(request.ticket.lockKey);

    if (existing && existing.owner === request.ticket.ownerToken) {
      this.locks.delete(request.ticket.lockKey);
    }

    return Promise.resolve();
  }

  /** Test helper: check if a key is currently held. */
  isHeld(key: string): boolean {
    const existing = this.locks.get(key);
    if (!existing) return false;
    if (existing.expiresAt <= Date.now()) {
      this.locks.delete(key);
      return false;
    }
    return true;
  }
}
