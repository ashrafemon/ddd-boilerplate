import { randomUUID } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@config/config.module';
import { RedisModule } from '@infrastructure/redis/redis.module';
import { RedisService } from '@infrastructure/redis/redis.service';
import { CacheAdapter } from '../../adapters/cache.adapter';
import { CachePort } from '../../ports/cache.port';
import { RedisCacheAdapter } from '../../adapters/redis-cache.adapter';
import { DeleteCacheValueUseCase } from '../../use-cases/delete-cache-value.usecase';
import { GetCacheValueUseCase } from '../../use-cases/get-cache-value.usecase';
import { SetCacheValueUseCase } from '../../use-cases/set-cache-value.usecase';

/**
 * Integration specification — the cache against real Redis.
 *
 * Proves what the unit tests can only fake: values round-trip as JSON, the TTL
 * is the server-side expiry, a corrupt entry degrades to MISS instead of
 * throwing, and eviction is idempotent.
 */

const TENANT = 'it-tenant';
const COMPANY = 'it-company';

describe('Cache round-trip (integration)', () => {
  let moduleRef: TestingModule;
  let cache: CachePort;
  let redis: RedisService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, RedisModule],
      providers: [
        RedisCacheAdapter,
        { provide: RedisCacheAdapter, useExisting: RedisCacheAdapter },
        GetCacheValueUseCase,
        SetCacheValueUseCase,
        DeleteCacheValueUseCase,
        CacheAdapter,
        { provide: CachePort, useExisting: CacheAdapter },
      ],
    }).compile();
    await moduleRef.init();
    cache = moduleRef.get(CachePort);
    redis = moduleRef.get(RedisService);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  const keyFor = (namespace = 'it') =>
    cache.buildKey({
      tenantId: TENANT,
      companyId: COMPANY,
      namespace,
      resource: `resource-${randomUUID()}`,
    });

  const client = () => {
    const value = redis.client;
    if (!value) throw new Error('redis client is not available');
    return value;
  };

  it('round-trips a value as JSON', async () => {
    const key = keyFor();
    const value = { id: 'po-1', lines: [{ sku: 'SKU-1', qty: 2 }], note: 'ünïcode' };

    await cache.set(key, value, 5_000);

    expect(await cache.get<typeof value>(key)).toEqual({ status: 'HIT', value });
  });

  it('expires the entry after the TTL', async () => {
    const key = keyFor();

    await cache.set(key, { stale: true }, 40);
    expect((await cache.get(key)).status).toBe('HIT');

    await new Promise(resolve => setTimeout(resolve, 120));

    expect(await cache.get(key)).toEqual({ status: 'MISS' });
  });

  it('deletes the entry and tolerates a second delete', async () => {
    const key = keyFor();

    await cache.set(key, { a: 1 }, 5_000);
    await cache.delete(key);
    await expect(cache.delete(key)).resolves.toBeUndefined();

    expect(await cache.get(key)).toEqual({ status: 'MISS' });
  });

  it('treats a corrupt entry as a MISS instead of throwing', async () => {
    const key = keyFor();
    await client().set(key, 'not-json{', 'PX', 5_000);

    await expect(cache.get(key)).resolves.toEqual({ status: 'MISS' });
  });
});
