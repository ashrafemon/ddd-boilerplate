# platform/idempotency — Duplicate-Suppression Ledger

> DB-backed "run this request/operation at most once" primitive with response
> replay. Distinct from `platform/locking`: locks prevent concurrency (Redis,
> leases, nothing stored), this prevents duplicate EFFECTS across time and
> replicas (Postgres, results stored).

## What it does

A reservation row unique on `(scope, tenantId, key)` is an insert-as-claim:

- first `reserve` INSERTs `IN_PROGRESS` → caller executes the work;
- a retried request hitting a `COMPLETED` row gets `REPLAY` + the stored
  response (`@Idempotent()` returns it verbatim — no handler run);
- a concurrent duplicate against `IN_PROGRESS` → 409 (safe to retry later);
- `FAILED` rows and expired `IN_PROGRESS` rows are atomically re-armed by
  `reserve`, so a failed operation can be retried immediately without
  waiting for the TTL.

## Public API

HTTP (preferred for controllers):

```ts
import { Idempotent } from '@platform/idempotency/http/idempotent.decorator';

@Post()
@Idempotent()                       // caller MUST send `Idempotency-Key` header
async submit(...) { ... }
```

The route-level interceptor is installed globally by `IdempotencyModule` but
stays inert (one metadata read) on every non-decorated route. Scope is
derived per route as `<ControllerClass>.<method>`.

Programmatic (use cases, queue handlers):

```ts
import { IdempotencyPort } from '@platform/idempotency/ports/idempotency.port';

const r = await idempotency.reserve({ scope: 'recurring.generate', key, tenantId });
if (r.status === 'ACQUIRED') {
  try { doWork(); await idempotency.markCompleted(ref, result); }
  catch (e) { await idempotency.markFailed(ref); throw e; }
} else if (r.status === 'REPLAY') return r.result;
else throw new ConflictException('in progress');
```

## Layout

```
ports/idempotency.port.ts                     token + reservation types
repositories/prisma-idempotency.repository.ts insert-as-claim + takeover SQL
http/idempotent.decorator.ts                  route decorator (metadata)
http/idempotency.interceptor.ts               reserve → run → store/replay
idempotency-reconciliation.ts                 hourly purge of expired rows
idempotency.module.ts                         bindings + APP_INTERCEPTOR
```

## Who calls it / how called

| Consumer | How |
| --- | --- |
| `POST /batch-operations` (submit) | `@Idempotent()` — reference usage |
| `POST /import/jobs` (create job) | `@Idempotent()` — reference usage |
| future services | inject `IdempotencyPort` |

## Data & config

- Table `idempotency_keys` (migrations in `prisma/migrations/*_idempotency_ledger`).
  `tenantId` is normalized to `''` for the unscoped case because Postgres
  unique indexes treat NULLs as distinct.
- `IDEMPOTENCY_TTL_MS` (default 24 h) = replay window + stale-claim takeover
  delay. Hourly reconcile deletes expired rows.

## Tenancy behaviour

Reservations are scoped per tenant (from `RequestContextPort`); two tenants
may reuse the same key string. In `TENANCY_MODE=multi` the key space is
authenticated via `TenancyAuthGuard`, so clients cannot poison each other's
keys.

## Rules & gotchas

- `@Idempotent()` requires the header — missing/blank key ⇒ 400, by design.
- The stored snapshot is the response pipeline output; replays of non-JSON
  side-effecting errors are still safe because `markFailed` re-arms the key.
- Only put `@Idempotent()` on non-idempotent verbs (POST). A GET is already
  replay-safe; adding it burns rows.
- Result column stores one JSON value — keep responses modest (this is an
  audit-ish ledger, not a cache; `platform/cache` exists for hot data).
