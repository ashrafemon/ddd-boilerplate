# platform/cache — Key/value cache primitive

> A driver-agnostic get/set/delete/exists cache for platform code, bound at
> module load to Redis **or** Memcached from `CACHE_DRIVER` — exactly one
> adapter ever instantiated.

## What it does

`CachePort.get/set/delete/exists` with optional TTL (seconds). Failures are
wrapped in `InfrastructureException` (never silently swallowed). The concrete
driver is picked by `infra/cache`'s shared client module; Memcached also has
an `onModuleDestroy` to close its socket.

## Public API

```ts
import { CachePort } from '@platform/cache/ports/cache.port';
await this.cache.set(key, value, ttlSeconds);
```

## Layout / bindings
```
ports/cache.port.ts
adapters/redis-cache.adapter.ts / memcached-cache.adapter.ts
cache.module.ts        driver resolved at load; provider→chosen adapter
resolveCacheDriver()   (in module file) reads CACHE_DRIVER
```
No tables. Config: infra `cache.*` (redis/memcached options).

## Who calls it / how called
Currently **no** cross-module consumer injects `CachePort` — it is a
ready primitive for hot read paths (e.g. company-config caching) when a real
need appears. Kept exported on `PlatformModule`.

## Tenancy & gotchas
- No tenancy logic — prefix keys with `tenantId` yourself (see cache-keys
  note in this repo's numbering/locking conventions).
- Do not treat cached values as a source of truth; this is a side store.
