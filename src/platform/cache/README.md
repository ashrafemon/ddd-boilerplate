# platform/cache — Disposable cache boundary

> Fast, non-authoritative key/value caching with tenant-safe key building,
> cache-aside convenience, and driver-agnostic storage (Redis or Memcached).

## What it does

Provides `CachePort` — the only cache capability business/application modules
should inject. Backed by `CacheStoragePort` (internal) → Redis or Memcached
adapter, selected by `CACHE_DRIVER` at module load. Exactly one adapter is
ever instantiated.

Key capabilities:
- `get<T>(key)` — retrieve cached value, null on miss (fail-open)
- `getWithResult<T>(key)` — explicit HIT/MISS discrimination
- `set<T>(key, value, ttlSeconds)` — store with bounded TTL
- `delete(key)` — idempotent removal
- `exists(key)` — check key presence
- `getOrSet<T>({ key, ttlSeconds, factory })` — cache-aside convenience

No use-case layer — the service directly delegates to the adapter. The cache
is a simple platform primitive, not a business domain.

**Cache is not the source of truth.** Business correctness remains in
PostgreSQL / the authoritative repository.

## Public API

```ts
import { CachePort } from '@platform/cache/ports/cache.port';
import { CacheKeyBuilderPort } from '@platform/cache/ports/cache-key-builder.port';

@Injectable()
export class GetProductUseCase {
  constructor(
    private readonly cache: CachePort,
    private readonly cacheKeys: CacheKeyBuilderPort,
    private readonly products: ProductQueryRepository,
  ) {}

  async execute(productId: string) {
    const key = this.cacheKeys.build({
      tenantId: 'tenant-001',
      organizationId: 'company-001',
      namespace: 'product',
      resource: productId,
      variant: 'summary',
    });

    // Cache-aside pattern
    return this.cache.getOrSet({
      key,
      ttlSeconds: 300,
      factory: () => this.products.findSummaryById(productId),
    });
  }
}
```

## Layout

```
platform/cache/
├── ports/
│   ├── cache.port.ts                    Public port — business injects this
│   ├── cache-storage.port.ts            Internal storage abstraction
│   └── cache-key-builder.port.ts        Deterministic key builder port
├── adapters/
│   ├── redis-cache.adapter.ts           Redis → CacheStoragePort
│   └── memcached-cache.adapter.ts       Memcached → CacheStoragePort
├── __testing__/
│   ├── in-memory-cache.adapter.ts       Fake for unit tests
│   └── fake-cache-key-builder.ts        Fake key builder for tests
├── cache-key.builder.ts                 Deterministic key builder impl
├── cache.service.ts                     Facade → CachePort (direct adapter call)
├── cache.types.ts                       CacheKey, requests, results
├── cache.module.ts                      Module wiring
└── README.md
```

## Who calls it / how called

| Consumer                      | How                                               |
| ----------------------------- | ------------------------------------------------- |
| Business application use case | `CachePort.get()` / `CachePort.getOrSet()`        |
| Business application use case | `CachePort.set()` / `CachePort.delete()`          |
| Event handler                 | `CachePort.delete()` for invalidation             |
| Message consumer              | `CachePort.delete()` for cross-process invalidation |
| Platform service              | Internal use as explicitly documented             |

Business modules do not access Redis/Memcached directly.

## Data & config

No database tables — Redis/Memcached owns the disposable entries.

Config: `src/config/cache.config.ts` + typed `ConfigService.getCache()`.

Environment variables:
```
CACHE_DRIVER=redis | memcache
REDIS_URL=redis://localhost:6379
MEMCACHED_HOST=localhost
MEMCACHED_PORT=11211
CACHE_KEY_PREFIX=cache
CACHE_KEY_VERSION=v1
```

## Tenancy behaviour

No built-in tenancy logic — use `CacheKeyBuilderPort` which includes
`tenantId` and `organizationId` in the key:

```
cache:v1:{tenantId}:{organizationId}:{namespace}:{resource}:{variant}
```

Platform-owned entries use `platform` as tenant/org:
```
cache:v1:platform:platform:exchange-rate:USD-BDT
```

## Rules & gotchas

- **Cache is not a database.** Never design business invariants around cache existence.
- **Cache is not a lock.** Use `DistributedLockPort` for exclusive ownership.
- **Cache is not idempotency.** Use `IdempotencyPort` for duplicate suppression.
- **Cache is not an outbox.** Use `OutboxWriterPort` for reliable event publication.
- **Cache is not a session store.** Session storage has its own boundary.
- Every cache entry should have a bounded TTL.
- Cross-process invalidation goes through Outbox → event handler → `CachePort.delete()`.
- Cache write failures are observable but must not roll back database writes.
- Business modules consume only `CachePort` — never `CacheStoragePort` or Redis directly.
- `CacheModule` is not `@Global()` — business modules must `imports: [PlatformModule]`.
- Use `useExisting` for port aliases — no duplicate class bindings.
- Do not expose Redis-specific types through public ports.
