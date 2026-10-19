# Design alignment — status

Tracks how far the `ddd-boilerplate` implementation has been brought in line
with the design docs in `~/Documents/Common/erp` (extracted to
`common/01`–`common/21`, `module/`, `iam/`). Branch: `align-to-design`.

> Baseline note: at the start of this work the repo was **not** green —
> `npx tsc` had 2 pre-existing errors (fixed during the idempotency rewrite) and
> `npm run lint:check` / `npm run format:check` failed on untouched files under
> `platform/events`, `platform/messaging`, `platform/saga` and one `scheduler`
> spec. As of the 04/05/06 cluster, **`tsc`, `lint:check`, `npm test` and
> `format:check` are all green** (180 tests).

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

### 05 · Event Bus — thin emit-only ✅
- `ports/in-process-event-bus.port.ts` — `emit(envelope)` + `MessageEnvelope`
  alias; `services/event-bus.service.ts` → `usecases/emit-event.usecase.ts` →
  `adapters/nest-event-bus.adapter.ts` (`emitter.emit(envelope.eventType, envelope)`),
  best-effort (a throwing listener is logged, never propagated).
- Deleted `message-routing.policy.ts`, `event-bus.config.ts`, `event-bus.types.ts`,
  `dispatchers/`, `registries/`, `bases/`, `ports/event-bus.port.ts`, the
  publish/register/unregister use cases, `__testing__/` and
  `src/bootstrap/configure-event-rehydration.ts` — **no routing table, no
  rehydration**.
- The 5 business `@OnEvent` listeners now take the canonical envelope
  (`MessageEnvelope`) and read `message.payload`; the 3 platform `onAny`
  projections (recurring / notification / webhook) read `envelope.payload` and
  the stable `envelope.eventId`.

### 06 · Message Queue — one publish-only port ✅
- `ports/message-queue.port.ts` — `publish(envelope)` only;
  `services/message-queue.service.ts` → `usecases/publish-message.usecase.ts`
  switches on `envelope.broker` (default `rabbitmq`). An unconfigured target
  throws so the outbox retries to `DEAD_LETTER`.
- Deleted `ports/message-publisher.port.ts`, `message-queue.module.ts`,
  `message-queue.types.ts`, the `consumers/` registry, the subscribe/ack/nack
  use cases and `__testing__/` — **no consumers, no subscribe registry**.
  `message-publisher.tokens.ts` keeps only the `BrokerPublisher` contract +
  DI tokens. `MessageQueueModule` merged into `messaging.module.ts`.
- The 12 business broker listeners now type the delivered message as the
  canonical `OutboxEnvelope`.

### 04 · Outbox — single port, three statuses ✅
- Public port is `outbox-writer.port.ts` with
  `append(event, aggregateType, aggregateId, opts?)` (`opts.broker` default
  `rabbitmq`); the `OutboxPort.append(request)` shape and `appendMany` are gone.
- `usecases/publish-pending-batch.usecase.ts` (claim → publish → emit → CAS
  settle) + `outbox.scheduler.ts` (dispatch tick + hourly cleanup). **No
  reconciler** — a crashed owner's lease is reclaimed by the same claim clause.
- Concrete `repositories/prisma-outbox.repository.ts` (no internal port); claim
  keeps `status=PENDING` and stamps `claimToken`/`claimedAt`; `availableAt`
  renamed `nextRetryAt` (migration `20261019130000_align_outbox_design`).
- Statuses `PENDING | PUBLISHED | DEAD_LETTER`; `outbox.types.ts` exposes the
  canonical `OutboxEnvelope`/`OutboxMessage` + `OutboxEvent`/`OutboxEventBase`.
- Business/platform `append(event, aggregateType, aggregateId)` callers unchanged;
  their event bases now import `OutboxEvent`/`OutboxEventBase` from
  `@platform/outbox/outbox.types`.

## Remaining

### 08 · Saga — runtime overlays, 5 tables
- Rewrite to `definitions / company_configs / instances / steps / inbox` with
  a plan-builder, event router, engine and step worker.

### Cross-cutting
- Remove the remaining `__testing__` doubles (notification, inbox, context,
  batch-operation, saga, webhook) — design: "common services ship no test
  doubles". Specs that rely on them must be rewritten with inline mocks.
- Docs: `ARCHITECTURE.md`, `docs/PLATFORM-SERVICES-COMPLETE-FLOW.md`,
  `docs/FLOWCHARTS.md`, `docs/BUSINESS-MODULE-GUIDE.md`,
  `docs/PLATFORM-SERVICE-GUIDE.md` and
  `docs/ARCHITECTURE-BUSINESS-MODULE-PATTERN.md` updated for the 04/05/06
  removals; the per-service READMEs for events/messaging/outbox rewritten.
- Naming: the design uses `companyId`; the code uses `organizationId`
  throughout. **Still open** — a global rename across every Prisma model,
  migration, business module and the request context. Deferred deliberately
  (large mechanical change, tracked here).

## Verify after each slice

```bash
npx tsc --noEmit -p tsconfig.json
npm run lint:check
npm test
npm run format:check
npm run docs:di
```
