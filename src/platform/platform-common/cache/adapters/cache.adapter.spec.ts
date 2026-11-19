import { CacheAdapter } from './cache.adapter';
import { CacheKey } from '../types/cache.types';
import { GetCacheValueUseCase } from '../use-cases/get-cache-value.usecase';
import { SetCacheValueUseCase } from '../use-cases/set-cache-value.usecase';
import { DeleteCacheValueUseCase } from '../use-cases/delete-cache-value.usecase';

/**
 * Unit — `CacheAdapter` owns key composition and nothing else; every read and
 * write is one use case call.
 */

const CONFIG = {
  keyPrefix: 'cache',
  keyVersion: 'v2',
  enabled: true,
  defaultTtlMs: 300_000,
  maxValueBytes: 1_048_576,
};

describe('CacheAdapter', () => {
  const getValue = { execute: jest.fn() };
  const setValue = { execute: jest.fn() };
  const deleteValue = { execute: jest.fn() };
  let adapter: CacheAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new CacheAdapter(
      getValue as unknown as GetCacheValueUseCase,
      setValue as unknown as SetCacheValueUseCase,
      deleteValue as unknown as DeleteCacheValueUseCase,
      { getCache: () => CONFIG } as never,
    );
  });

  describe('buildKey', () => {
    it('joins prefix, version, scope, namespace, resource and variant in order', () => {
      const key = adapter.buildKey({
        tenantId: 'tenant-1',
        companyId: 'company-1',
        namespace: 'http',
        resource: 'purchase-order',
        variant: 'po-1',
      });

      expect(key).toBe('cache:v2:tenant-1:company-1:http:purchase-order:po-1');
    });

    it('falls back to the platform scope and the default variant', () => {
      expect(adapter.buildKey({ namespace: 'http', resource: 'health' })).toBe(
        'cache:v2:platform:platform:http:health:default',
      );
    });

    it('escapes separators so one field can never impersonate two', () => {
      const split = adapter
        .buildKey({ tenantId: 'a:a', companyId: 'b', namespace: 'n', resource: 'r' })
        .split(':');

      expect(split).toHaveLength(7);
      expect(split[2]).toBe('a%3Aa');
    });

    it('keeps the key deterministic for the same identity', () => {
      const identity: CacheKey = {
        tenantId: 't',
        companyId: 'c',
        namespace: 'n',
        resource: 'r',
      };

      expect(adapter.buildKey(identity)).toBe(adapter.buildKey({ ...identity }));
    });
  });

  describe('delegation', () => {
    it('reads through the get use case', async () => {
      getValue.execute.mockResolvedValue({ status: 'MISS' });

      await adapter.get('k');

      expect(getValue.execute).toHaveBeenCalledWith('k');
    });

    it('writes through the set use case with the caller TTL', async () => {
      setValue.execute.mockResolvedValue(undefined);

      await adapter.set('k', { a: 1 }, 1_000);

      expect(setValue.execute).toHaveBeenCalledWith('k', { a: 1 }, 1_000);
    });

    it('deletes through the delete use case', async () => {
      deleteValue.execute.mockResolvedValue(undefined);

      await adapter.delete('k');

      expect(deleteValue.execute).toHaveBeenCalledWith('k');
    });
  });
});
