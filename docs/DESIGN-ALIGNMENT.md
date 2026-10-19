# Design alignment — status

Tracks how far the `ddd-boilerplate` implementation has been brought in line
with the design docs in `~/Documents/Common/erp` (extracted to
`common/01`–`common/21`, `module/`, `iam/`). Branch: `align-to-design`.

> Baseline note: at the start of this work the repo was **not** green —
> `npx tsc` had 2 pre-existing errors (now fixed) and `npm run lint:check` /
> `npm run format:check` fail on untouched files under `platform/events`,
> `platform/messaging`, `platform/saga` and one `scheduler` spec. `npm test`
> (206 tests) passes.

## Done

### 03 · Distributed Lock — Redis-only ✅
- Dropped `distributed_locks` Prisma model + repository (design: no schema,
  no repository). Ownership, lease and fencing tokens all live in Redis.
- Fencing token now allocated with Redis `INCR` (`lock:fence:*`).
- Lease clamped into `[LOCK_MIN_LEASE_MS, LOCK_MAX_LEASE_MS]`; default
  `LOCK_DEFAULT_LEASE_MS`.
- Service at `services/locking.service.ts`; `__testing__` double removed.

### 02 · Idempotency — Postgres claims + Redis replay ✅
- Statuses are `IN_PROGRESS | COMPLETED` only; `error_code`/`error_message`
  dropped (migration `20261019120000_align_idempotency_design`).
- Reserve checks a Redis result cache first; result statuses
  `ACQUIRED | REPLAY | BUSY | KEY_MISMATCH`.
- `fail()` CAS-deletes the row and evicts the Redis key (no parking lot).
- Concrete `PrismaIdempotencyRepository` (no internal repository port).
- Hourly `IdempotencyReconciliation` deletes expired rows.
- Service moved to `services/idempotency.service.ts`; `__testing__` removed.

### 01 · Cache — disposable cache-aside ✅
- `CachePort` is now `buildKey` + `get(HIT|MISS)` + `set(ttlMs)` + `delete`.
- `buildKey` lives on the service; `RedisCacheAdapter` is concrete (no storage
  port), JSON serialize + `SET PX`, fail-open, `CACHE_ENABLED` honoured.
- Removed memcached adapter, key-builder port, `exists`/`getOrSet`/`withResult`
  use cases and `__testing__` doubles.
- Config: `CACHE_ENABLED`, `CACHE_DEFAULT_TTL_MS`, `CACHE_MAX_VALUE_BYTES`,
  `CACHE_KEY_PREFIX`, `CACHE_KEY_VERSION`.

## Remaining

### 05 · Event Bus — thin emit-only
- Port must become `in-process-event-bus.port.ts` with `emit(envelope)`
  (current: `event-bus.port.ts` publish/register/unregister).
- Delete `message-routing.policy.ts`, `event-bus.config.ts`, the
  `dispatchers/` + `registries/` + `src/bootstrap/configure-event-rehydration.ts`
  machinery (design: **no routing table, no rehydration step**).
- Business `@OnEvent` listeners must take the envelope
  (`message.payload`) instead of a rehydrated event object.

### 06 · Message Queue — one publish-only port
- Collapse to `ports/message-queue.port.ts` + `services/message-queue.service.ts`
  + `usecases/publish-message.usecase.ts` switching on `envelope.broker`.
- Delete `ports/message-publisher.port.ts`, `message-publisher.tokens.ts`,
  `consumers/message-consumer.registry.ts`, `subscribe`/`ack`/`nack` use cases
  and `__testing__` doubles (design: **no consumers, no subscribe registry**).

### 04 · Outbox — single port, three statuses
- Public port is `outbox-writer.port.ts` with
  `append(event, aggregateType, aggregateId, opts?)` (`opts.broker` default
  `rabbitmq`); remove the newer `OutboxPort.append(request)` shape.
- Statuses `PENDING | PUBLISHED | DEAD_LETTER` (drop `CLAIMED`/`FAILED`).
- `usecases/publish-pending-batch.usecase.ts` +
  `outbox.scheduler.ts`; **no reconciler** (expired `claimedAt` is reclaimed by
  the same claim clause). Hourly cleanup deletes old PUBLISHED rows.
- `outbox.types.ts` exposes one canonical `OutboxMessage`/`OutboxEnvelope`.
- Cascades to the 5 business outbox adapters + batch/import/notification/
  webhook outbox writers.

### 08 · Saga — runtime overlays, 5 tables
- Rewrite to `definitions / company_configs / instances / steps / inbox` with
  a plan-builder, event router, engine and step worker.

### Cross-cutting
- Remove the remaining `__testing__` doubles (events, messaging, inbox,
  scheduler, webhook, …) — design: "common services ship no test doubles".
  Specs that rely on them must be rewritten with inline mocks.
- Update `ARCHITECTURE.md`, `docs/PLATFORM-SERVICES-COMPLETE-FLOW.md` and the
  per-service READMEs for the removals above.
- Naming: the design uses `companyId`; the code uses `organizationId`
  throughout. Decide whether to rename globally.

## Verify after each slice

```bash
npx tsc --noEmit -p tsconfig.json
npm run lint:check
npm test
npm run format:check
npm run docs:di
```
