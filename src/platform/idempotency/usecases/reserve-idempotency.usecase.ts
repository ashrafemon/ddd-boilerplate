import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ConfigService } from '@config/config.service';
import { PrismaIdempotencyRepository } from '../repositories/prisma-idempotency.repository';
import { RedisIdempotencyCacheAdapter } from '../adapters/redis-idempotency-cache.adapter';
import {
  IdempotencyIdentity,
  IdempotencyReservation,
  IdempotencyReserveRequest,
  IdempotencyReserveResult,
} from '../idempotency.types';

/**
 * Use case: reserve an idempotency key (design `common/02-idempotency`).
 *
 * 1. Redis result cache HIT → REPLAY without touching Postgres
 * 2. Otherwise INSERT-as-claim on the unique identity → ACQUIRED
 * 3. Row COMPLETED with the same hash → REPLAY (cache it back)
 * 4. Row COMPLETED with a different hash → KEY_MISMATCH
 * 5. Row IN_PROGRESS with a live lease → BUSY
 * 6. Row IN_PROGRESS with an expired lease → CAS takeover → ACQUIRED
 */
@Injectable()
export class ReserveIdempotencyUseCase {
  constructor(
    private readonly repository: PrismaIdempotencyRepository,
    private readonly cache: RedisIdempotencyCacheAdapter,
    private readonly configService: ConfigService,
  ) {}

  async execute(request: IdempotencyReserveRequest): Promise<IdempotencyReserveResult> {
    const { ttlMs: defaultTtlMs, claimLeaseMs } = this.configService.getIdempotency();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (request.ttlMs ?? defaultTtlMs));

    const identity: IdempotencyIdentity = {
      tenantId: request.tenantId,
      companyId: request.companyId,
      scope: request.scope,
      key: request.key,
    };
    const cacheKey = this.cache.buildKey(identity);

    // 1. Fast replay path — COMPLETED results only.
    const cached = await this.cache.get(cacheKey);
    if (cached.hit) {
      return { status: 'REPLAY', result: cached.value };
    }

    // 2. Insert-as-claim. The unique index is the concurrent-reserve guard.
    const claimToken = randomUUID();
    try {
      const inserted = await this.repository.insertClaim(
        identity,
        claimToken,
        expiresAt,
        request.requestHash,
      );
      return this.acquired(identity, inserted.id, claimToken, inserted.version);
    } catch {
      // Unique violation — a row already exists; fall through to inspect it.
    }

    const existing = await this.repository.findByIdentity(identity);
    if (!existing) {
      // Row vanished between insert and read (fail/expiry). Retry once.
      const inserted = await this.repository.insertClaim(
        identity,
        claimToken,
        expiresAt,
        request.requestHash,
      );
      return this.acquired(identity, inserted.id, claimToken, inserted.version);
    }

    // 3/4. Same key, different payload is a client error.
    if (
      existing.requestHash &&
      request.requestHash &&
      existing.requestHash !== request.requestHash
    ) {
      return { status: 'KEY_MISMATCH' };
    }

    if (existing.status === 'COMPLETED') {
      const remainingMs = existing.expiresAt.getTime() - Date.now();
      if (remainingMs > 0) {
        await this.cache.set(cacheKey, existing.resultJson, remainingMs);
      }
      return { status: 'REPLAY', result: existing.resultJson };
    }

    // 5/6. IN_PROGRESS: BUSY while the lease is live, otherwise take over.
    const cutoff = new Date(now.getTime() - claimLeaseMs);
    const taken = await this.repository.takeoverExpiredClaim(
      identity,
      claimToken,
      cutoff,
      expiresAt,
    );
    if (taken) {
      return this.acquired(identity, taken.id, claimToken, taken.version);
    }

    return { status: 'BUSY' };
  }

  private acquired(
    identity: IdempotencyIdentity,
    id: string,
    claimToken: string,
    version: number,
  ): IdempotencyReserveResult {
    const reservation: IdempotencyReservation = {
      ...identity,
      id,
      claimToken,
      version,
    };
    return { status: 'ACQUIRED', reservation };
  }
}
