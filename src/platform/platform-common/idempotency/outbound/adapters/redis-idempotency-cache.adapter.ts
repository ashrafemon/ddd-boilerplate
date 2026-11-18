import { Injectable, Logger, Optional } from '@nestjs/common';
import { RedisService } from '@infrastructure/redis/redis.service';
import { ConfigService } from '@config/config.service';
import { IdempotencyCacheLookup, IdempotencyIdentity } from '../../types/idempotency.types';
import { IdempotencyReplayCachePort } from '../ports/idempotency-replay-cache.port';

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
export class RedisIdempotencyCacheAdapter implements IdempotencyReplayCachePort {
  private readonly logger = new Logger(RedisIdempotencyCacheAdapter.name);

  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly redisService?: RedisService,
  ) {}

  /**
   * `{prefix}:{tenant}:{company}:{scope}:{key}` with every part percent-encoded.
   *
   * Escaping is not cosmetic: without it a ':' inside a field shifts the
   * separator across boundaries, so (tenant 'a:a', company 'a') and
   * (tenant 'a', company 'a:a') would map to the same replay key and one
   * tenant could replay another tenant's stored result. The injectivity
   * property in specifications/properties/ proves it stays that way.
   */
  buildKey(identity: IdempotencyIdentity): string {
    const { redisPrefix } = this.configService.getIdempotency();
    return [redisPrefix, identity.tenantId, identity.companyId, identity.scope, identity.key]
      .map(part => encodeURIComponent(part))
      .join(':');
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
