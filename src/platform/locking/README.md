# platform/locking — Distributed Lock

> Cross-instance mutual exclusion ("run this on exactly one replica right
> now"), backed by Redis with owner-token fencing. Formerly private to
> `platform/scheduler`; extracted as a shared platform primitive.

## What it does

`DistributedLockPort` provides short-lived leases keyed by an arbitrary
string. Acquisition is `SET NX PX`; renewal and release run compare-and-act
Lua scripts bound to the random owner token captured in the returned
`LockTicket`, so a worker whose lease expired can never extend or delete a
lock that another instance has since taken over.

**Fail closed.** Redis missing/unavailable/erroring ⇒ `acquire` resolves to
`null`. Callers MUST skip their work unit in that case — never run
speculatively. Stuck `CLAIMED`-style rows are recovered by the owning
service's reconciler, not by loosening the lock.

## Public API

```ts
import { DistributedLockPort, LockTicket } from '@platform/locking/ports/distributed-lock.port';

acquire(key, ttlMs): Promise<LockTicket | null>   // take a lease, or null
renew(ticket, ttlMs): Promise<boolean>            // extend, false = ownership lost
release(ticket): Promise<void>                    // compare-and-delete, best effort
isHeld(key): Promise<boolean>                     // observability only
```

Callers namespace their own keys (`scheduler` passes the job id; the Redis
key is `platform:lock:<key>`).

## Layout

```
ports/distributed-lock.port.ts        the token (abstract class)
adapters/redis-distributed-lock.adapter.ts   Redis SET NX + Lua implementation
locking.module.ts                     binds port → adapter, exports the port
```

## Who calls it / how called

| Consumer | How | Why |
| --- | --- | --- |
| `platform/scheduler` `DispatchDueJobsUseCase` | injects `DistributedLockPort` (via `LockingModule` import) | per-job Redis lock during dispatch; failure leaves the row CLAIMED for reconciliation |

New consumers `@platform/...` style: import `LockingModule`, inject the port.
Business modules must NOT use this — locking is a platform concern.

## Data & config

No tables. Redis client comes from `CacheModule.forRoot()` (infrastructure).
Lease TTLs are passed by the caller (scheduler: `SCHEDULER_LOCK_TTL_MS`).

## Tenancy behaviour

None — keys are caller-chosen; include the tenant in the key if the lock is
per-tenant (`lock:\`${tenantId}:${thing}\``).

## Rules & gotchas

- Release only with the ticket `acquire` returned for THIS run — never by key.
- Locks are leases, not transactions: pair with a DB-side guard (status CAS
  or claim) for correctness (the scheduler does exactly this).
- Do not hold a lock across long unbounded work without `renew` (see the
  import service's `StageLock`, which heartbeats on a timer).
- `isHeld` is racy by nature; use for metrics/logs, never for decisions.
