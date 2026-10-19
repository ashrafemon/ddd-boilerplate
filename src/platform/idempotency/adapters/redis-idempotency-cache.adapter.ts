import { Injectable, Logger, Optional } from '@nestjs/common';
import { RedisService } from '@infrastructure/redis/redis.service';
import { ConfigService } from '@config/config.service';
import { IdempotencyIdentity } from '../idempotency.types';

/** Cache lookup result — distinguishes a cached `null` from a miss. */
export type IdempotencyCacheLookup = { hit: true; value: unknown } | { hit: false };

/**
 * Redis adapter for COMPLETED idempotency results (design
 * `common/02-idempotency`).
 *
 * - Caches results only, never claims — claims collide on the Postgres unique
 *   key so concurrent reserves are always correct.
 * - Key: `{prefix}:{tenant}:{company}:{scope}:{key}`; TTL copied from the row's
 *   `expiresAt`, so cache and row expire together.
 * - Fail-open: Redis down simply means a Postgres replay (still correct).
 */
@Injectable()
export class RedisIdempotencyCacheAdapter {
  private readonly logger = new Logger(RedisIdempotencyCacheAdapter.name);

  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly redisService?: RedisService,
  ) {}

  buildKey(identity: IdempotencyIdentity): string {
    const { redisPrefix } = this.configService.getIdempotency();
    return [redisPrefix, identity.tenantId, identity.companyId, identity.scope, identity.key].join(
      ':',
    );
  }

  async get(key: string): Promise<IdempotencyCacheLookup> {
    const client = this.clientOrNull();
    if (!client) return { hit: false };
    try {
      const raw = await client.get(key);
      if (raw === null || raw === undefined) return { hit: false };
      return { hit: true, value: JSON.parse(raw) as unknown };
    } catch (err) {
      this.logger.warn(
        `Idempotency cache read failed (fail-open): ${err instanceof Error ? err.message : String(err)}`,
      );
      return { hit: false };
    }
  }

  async set(key: string, value: unknown, ttlMs: number): Promise<void> {
    if (ttlMs <= 0) return;
    const client = this.clientOrNull();
    if (!client) return;
    try {
      await client.set(key, JSON.stringify(value), 'PX', ttlMs);
    } catch (err) {
      this.logger.warn(
        `Idempotency cache write failed (fail-open): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async delete(key: string): Promise<void> {
    const client = this.clientOrNull();
    if (!client) return;
    try {
      await client.del(key);
    } catch (err) {
      this.logger.warn(
        `Idempotency cache eviction failed (fail-open): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private clientOrNull() {
    try {
      return this.redisService?.client ?? null;
    } catch {
      return null;
    }
  }
}
