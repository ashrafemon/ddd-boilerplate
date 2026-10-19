# Platform — Distributed Lock Service (Redis-only)

## 1. Purpose

One-winner-now ownership of a resource across replicas (scheduler ticks,
numbering sequences, batch chunks). Leases are fail-closed: a caller that
cannot take the lock must skip the work unit, never run it speculatively.

| Concern | Handled here |
|---|---|
| Redis lock ownership (SET NX PX + Lua) | ✅ `RedisDistributedLockAdapter` |
| Monotonic fencing token sequence | ✅ Redis `INCR` (no PostgreSQL) |
| Key structure | ✅ `LockKeyBuilder` |
| Business modules talk to | `DistributedLockPort` only |

## 2. API

Inject `DistributedLockPort` and control the sequence:

```ts
const lock = await this.distributedLock.acquire({
  tenantId, organizationId, scope: 'numbering.invoice', resource: sequenceId,
});
if (lock.status === 'BUSY') throw new ConflictException();
try {
  return await this.nextNumber(sequenceId);
} finally {
  await this.distributedLock.release({ ticket: lock.ticket });
}
```

- `acquire({ tenantId, organizationId, scope, resource, leaseMs? })`
  → `ACQUIRED + ticket` or `BUSY + retryAfterMs`. Never waits/blocks.
- `renew({ ticket, leaseMs? })` → `RENEWED` or `LOST` (stop work immediately).
- `release({ ticket })` → `void`. Always in a `finally`.

The ticket carries `lockKey`, `ownerToken`, `fencingToken`, `acquiredAt`,
`expiresAt`.

## 3. Layout

```
src/platform/locking/
├── ports/
│   ├── distributed-lock.port.ts   # public port
│   └── redis-lock.port.ts         # low-level Redis operations
├── services/
│   └── locking.service.ts         # implements DistributedLockPort
├── usecases/
│   ├── acquire-distributed-lock.usecase.ts
│   ├── renew-distributed-lock.usecase.ts
│   └── release-distributed-lock.usecase.ts
├── adapters/
│   └── redis-distributed-lock.adapter.ts
├── lock-key.builder.ts
├── locking.types.ts
├── locking.module.ts
└── README.md
src/config/locking.config.ts       # getLocking()
```

**Redis-only:** no Prisma schema, no repository. Ownership, lease TTL and the
fencing-token counter live in Redis (`lock:*` and `lock:fence:*`).

## 4. Data & keys

| Store | What it holds |
|---|---|
| Redis `lock:{tenant}:{organizationId}:{scope}:{resource}` | active owner token, PX lease |
| Redis `lock:fence:{tenant}:…` | monotonic fencing counter (INCR) |

The adapter uses the shared infrastructure Redis client (the same one the Cache
adapter uses) but never calls `CachePort`: lock is fail-closed ownership, cache
is fail-open disposable reads.

## 5. Config (`src/config/locking.config.ts`)

| Env | Default | Meaning |
|---|---|---|
| `LOCK_DEFAULT_LEASE_MS` | `30000` | lease when the caller omits `leaseMs` |
| `LOCK_MIN_LEASE_MS` | `5000` | lower clamp |
| `LOCK_MAX_LEASE_MS` | `300000` | upper clamp |
| `LOCK_RENEW_INTERVAL_MS` | `10000` | recommended renew cadence guidance |

Every request is clamped into `[min, max]`.

## 6. Failure semantics

| Scenario | Behavior |
|---|---|
| Redis down / error during acquire | `BUSY` (fail-closed, logged) |
| Redis error during release | silently ignored (TTL expires it) |
| owner token mismatch on renew | `LOST` |
| owner token mismatch on release | silently ignored |
| fencing token allocation failure | throws (never assume ownership) |

## 7. Rules

- Lock ≠ cache ≠ idempotency. Short lease + periodic renew; release in `finally`.
- Scope examples: `inventory.stock`, `numbering.invoice`, `scheduler.job`,
  `batch.operation`.
- Redis keyspace `lock:*` is owned solely by this service.
- Never wait/block inside the service — the caller decides retry / 409 / queue.
