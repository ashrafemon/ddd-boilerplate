# Platform — Cache Service

## 1. Purpose

Disposable key-value speed layer (Redis) for hot reads. Never the source of
truth — the database/repository is always authoritative, and the app stays
correct with the cache disabled.

| Concern | Handled here |
|---|---|
| Key convention (`buildKey`) | ✅ `CachePort` / `CacheService` |
| Redis get/set/delete | ✅ `RedisCacheAdapter` |
| Business modules talk to | `CachePort` only |

## 2. API

```ts
const cacheKey = this.cache.buildKey({
  tenantId, organizationId, namespace: 'client', resource: clientId,
});
const cached = await this.cache.get<ClientView>(cacheKey);
if (cached.status === 'MISS') {
  const clientView = await this.clientRepository.find(clientId);
  await this.cache.set(cacheKey, clientView, 300_000); // ttlMs
  return clientView;
}
return cached.value;
```

- `buildKey(identity)` → `cache:v1:{tenant}:{company}:{namespace}:{resource}:{variant}`
- `get(cacheKey)` → `HIT + value` or `MISS` (MISS also covers Redis down/corrupt)
- `set(cacheKey, value, ttlMs?)` → stores JSON; default TTL from config
- `delete(cacheKey)` → removes one key; missing counts as success

## 3. Layout

```
src/platform/cache/
├── ports/cache.port.ts                    # the only port
├── services/cache.service.ts              # implements CachePort; buildKey lives here
├── usecases/
│   ├── get-cache-value.usecase.ts
│   ├── set-cache-value.usecase.ts
│   └── delete-cache-value.usecase.ts
├── adapters/redis-cache.adapter.ts        # concrete; JSON serialize, SET PX ttl
├── cache.types.ts
├── cache.module.ts
└── README.md
src/config/cache.config.ts                 # getCache()
```

**No Prisma schema. No storage port. No registry.**

## 4. Invalidation

Cross-process invalidation goes through the Outbox: the write transaction
commits, a change-consumer calls `delete(cacheKey)`. Same-process code may also
delete after commit — never inside the transaction.

## 5. Config (`src/config/cache.config.ts`)

| Env | Default | Meaning |
|---|---|---|
| `CACHE_ENABLED` | `true` | `false` ⇒ get MISS, set/delete no-op |
| `CACHE_DEFAULT_TTL_MS` | `300000` | default per-entry life |
| `CACHE_MAX_VALUE_BYTES` | `1048576` | entries above 1 MB stay in the DB |
| `CACHE_KEY_PREFIX` / `CACHE_KEY_VERSION` | `cache` / `v1` | bump the version, never scan-delete |

## 6. Rules

- Cache read models (`XxxView` / `LookupItem`), never live aggregates; never
  passwords/secrets.
- Keyspace `cache:*` only; tenant/company always in the key for tenant data;
  no `KEYS` scans (explicit keys + TTL + version bump).
- Never use cache for locks or dedupe.
- Fail-open everywhere: Redis errors degrade to the authoritative source and
  never roll back a DB transaction.
