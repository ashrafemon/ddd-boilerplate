import { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, Observable, of, throwError } from 'rxjs';
import fc from 'fast-check';
import { HttpCacheInterceptor, buildHttpCacheKey } from './http-cache.interceptor';
import { HTTP_CACHEABLE_KEY } from '../decorators/http-cacheable.decorator';
import { HTTP_CACHE_EVICT_KEY } from '../decorators/http-cache-evict.decorator';

/**
 * Unit — the HTTP response cache driver with a map-backed store.
 *
 * Asserts the route contract: opt-in only, disabled cache is inert, HIT skips
 * the handler, a MISS stores the handler value with the TTL, eviction runs only
 * on success and also drops the parent collection, and a store failure is a
 * MISS rather than an error. The key-composition properties at the bottom are
 * the regression guard for tenant-boundary collisions.
 */

interface Stored {
  value: unknown;
  ttl?: number;
}

function makeCache() {
  const store = new Map<string, Stored>();
  return {
    store,
    get: jest.fn(async (key: string) => store.get(key)?.value),
    set: jest.fn(async (key: string, value: unknown, ttl?: number) => {
      store.set(key, { value, ttl });
      return value;
    }),
    del: jest.fn(async (key: string) => store.delete(key)),
  };
}

const CONFIG = { enabled: true, ttlMs: 30_000 };

function makeContext(overrides: {
  request?: Record<string, unknown>;
  handlerMeta?: Record<string, unknown>;
  type?: string;
}): ExecutionContext {
  const request = {
    method: 'GET',
    originalUrl: '/api/v1/purchase-orders/po-1',
    ...overrides.request,
  };
  return {
    getType: () => overrides.type ?? 'http',
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => ({}) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function makeInterceptor(options: {
  cache: ReturnType<typeof makeCache>;
  enabled?: boolean;
  meta?: Record<string, unknown>;
}) {
  const config = { ...CONFIG, enabled: options.enabled ?? true };
  const reflector = {
    get: (key: string) => options.meta?.[key],
  };
  return new HttpCacheInterceptor(
    options.cache as never,
    { getHttpCache: () => config } as never,
    { getTenantId: () => 'tenant-1', getCompanyId: () => 'company-1' } as never,
    reflector as never,
  );
}

const nextReturning = (value: unknown) => ({ handle: () => of(value) }) as CallHandler;

describe('HttpCacheInterceptor', () => {
  it('passes through when the route opts out', async () => {
    const cache = makeCache();
    const result = await makeInterceptor({ cache, meta: {} }).intercept(
      makeContext({}),
      nextReturning('fresh'),
    );

    await expect(firstValue(result)).resolves.toBe('fresh');
    expect(cache.get).not.toHaveBeenCalled();
  });

  it('is inert while HTTP_CACHE_ENABLED=false', async () => {
    const cache = makeCache();
    const result = await makeInterceptor({
      cache,
      enabled: false,
      meta: { [HTTP_CACHEABLE_KEY]: {} },
    }).intercept(makeContext({}), nextReturning('fresh'));

    await expect(firstValue(result)).resolves.toBe('fresh');
    expect(cache.get).not.toHaveBeenCalled();
  });

  it('stores the handler value on a MISS', async () => {
    const cache = makeCache();
    const result = await makeInterceptor({
      cache,
      meta: { [HTTP_CACHEABLE_KEY]: { ttlMs: 1_500 } },
    }).intercept(makeContext({}), nextReturning({ data: 'po-1' }));

    await expect(firstValue(result)).resolves.toEqual({ data: 'po-1' });

    const key = 'http:tenant-1:company-1:GET:%2Fapi%2Fv1%2Fpurchase-orders%2Fpo-1';
    expect(cache.set).toHaveBeenCalledWith(key, { data: 'po-1' }, 1_500);
  });

  it('returns the stored value without running the handler on a HIT', async () => {
    const cache = makeCache();
    cache.store.set('http:tenant-1:company-1:GET:%2Fapi%2Fv1%2Fpurchase-orders%2Fpo-1', {
      value: { data: 'cached' },
    });
    const handle = jest.fn(() => of({ data: 'fresh' }));
    const next = { handle } as unknown as CallHandler;

    const result = await makeInterceptor({ cache, meta: { [HTTP_CACHEABLE_KEY]: {} } }).intercept(
      makeContext({}),
      next,
    );

    await expect(firstValue(result)).resolves.toEqual({ data: 'cached' });
    expect(handle).not.toHaveBeenCalled();
  });

  it('treats a store error as a MISS', async () => {
    const cache = makeCache();
    cache.get.mockRejectedValueOnce(new Error('store down'));

    const result = await makeInterceptor({ cache, meta: { [HTTP_CACHEABLE_KEY]: {} } }).intercept(
      makeContext({}),
      nextReturning('fresh'),
    );

    await expect(firstValue(result)).resolves.toBe('fresh');
  });

  it('evicts the entry and the parent collection after a mutation', async () => {
    const cache = makeCache();
    const ctx = makeContext({
      request: { method: 'PATCH', originalUrl: '/api/v1/purchase-orders/po-1' },
    });

    const result = await makeInterceptor({ cache, meta: { [HTTP_CACHE_EVICT_KEY]: {} } }).intercept(
      ctx,
      nextReturning({ ok: true }),
    );

    await expect(firstValue(result)).resolves.toEqual({ ok: true });
    expect(cache.del).toHaveBeenCalledWith(
      'http:tenant-1:company-1:GET:%2Fapi%2Fv1%2Fpurchase-orders%2Fpo-1',
    );
    expect(cache.del).toHaveBeenCalledWith(
      'http:tenant-1:company-1:GET:%2Fapi%2Fv1%2Fpurchase-orders',
    );
  });

  it('does not evict when the mutation fails', async () => {
    const cache = makeCache();
    const failing = { handle: () => throwErrorLike() } as CallHandler;

    const result = await makeInterceptor({ cache, meta: { [HTTP_CACHE_EVICT_KEY]: {} } }).intercept(
      makeContext({ request: { method: 'DELETE' } }),
      failing,
    );

    await expect(firstValue(result)).rejects.toThrow('boom');
    expect(cache.del).not.toHaveBeenCalled();
  });

  it('ignores non-HTTP execution contexts', async () => {
    const cache = makeCache();
    const result = await makeInterceptor({
      cache,
      meta: { [HTTP_CACHEABLE_KEY]: {} },
    }).intercept(makeContext({ type: 'rpc' }), nextReturning('event'));

    await expect(firstValue(result)).resolves.toBe('event');
    expect(cache.get).not.toHaveBeenCalled();
  });
});

describe('buildHttpCacheKey properties', () => {
  const segment = fc.string({ unit: fc.constantFrom('a', 'b', ':', '%', '/', '?', '0') });

  it('is stable for the same identity', () => {
    fc.assert(
      fc.property(segment, segment, segment, (tenantId, companyId, url) => {
        const identity = { tenantId, companyId, method: 'GET', url };
        expect(buildHttpCacheKey(identity)).toBe(buildHttpCacheKey({ ...identity }));
      }),
    );
  });

  it('never lets a value shift across a field boundary', () => {
    fc.assert(
      fc.property(segment, segment, segment, (tenantId, companyId, url) => {
        expect(
          buildHttpCacheKey({ tenantId, companyId, method: 'GET', url }).split(':'),
        ).toHaveLength(5);
      }),
    );
  });

  it('distinguishes tenants whose ids contain the separator', () => {
    const left = buildHttpCacheKey({
      tenantId: 'a:a',
      companyId: 'a',
      method: 'GET',
      url: '/x',
    });
    const right = buildHttpCacheKey({
      tenantId: 'a',
      companyId: 'a:a',
      method: 'GET',
      url: '/x',
    });

    expect(left).not.toBe(right);
  });
});

function firstValue(observable: unknown): Promise<unknown> {
  return firstValueFrom(observable as Observable<unknown>);
}

function throwErrorLike(): Observable<never> {
  return throwError(() => new Error('boom'));
}
