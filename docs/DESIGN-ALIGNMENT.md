# Design alignment — status

Tracks how far the `ddd-boilerplate` implementation has been brought in line
with the design docs in `~/Documents/Common/erp` (extracted to
`common/01`–`common/21`, `module/`, `iam/`). Branch: `align-to-design`.

> Baseline note: at the start of this work the repo was **not** green —
> `npx tsc` had 2 pre-existing errors (fixed during the idempotency rewrite) and
> `npm run lint:check` / `npm run format:check` failed on untouched files under
> `platform/events`, `platform/messaging`, `platform/saga` and one `scheduler`
> spec. As of the 04/05/06 cluster, **`tsc`, `lint:check`, `npm test` and
> `format:check` are all green** (187 tests).

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

### 07 · Inbox — consumer-side deduplication ✅

- Statuses narrowed to `IN_PROGRESS | PROCESSED | SUSPENDED`; `FAILED` and the
  `MESSAGE_REUSED`/payload-hash machinery dropped. Receive results are
  `ACQUIRED | DUPLICATE | BUSY` (the reserve-everything pattern: only `ACQUIRED`
  proceeds, ACK only after `complete`).
- `receive` = INSERT-as-claim on `(tenant, company, consumer, messageId)`;
  `IN_PROGRESS` is `BUSY` while the claim is live (inside
  `INBOX_CLAIM_LEASE_MS`) or the retry is not due, otherwise CAS re-claimed on
  the stored token (`attempts + 1`). `fail` keeps the row `IN_PROGRESS` with an
  exponential `nextAttemptAt` (broker NACK drives redelivery).
- Internal `InboxRepositoryPort` + `ClaimInboxRetryUseCase` removed —
  `PrismaInboxRepository` is concrete and injected into the use cases.
- Reconciler (`@Cron` 60s) parks expired poison (`attempts > max`) `SUSPENDED`
  and backoffs the rest; the same sweep deletes `PROCESSED` past retention.
- Table trimmed to the design columns (`message_version`, `payload_hash`,
  `occurred_at`, `received_at`, `error_*`, `version` dropped); migration
  `20261019150000_align_inbox_design` (the table had never been migrated).
- `__testing__/in-memory-inbox.repository.ts` deleted; the spec builds an inline
  fake. Config gained `INBOX_PROCESSED_RETENTION_MS`, dropped `INBOX_BATCH_SIZE`.

### 08 · Saga — company-configurable, five tables ✅

- Five tables: `saga_definitions` (one ACTIVE per key, found by event
  name+version), `saga_company_configs` (one ACTIVE overlay per company+key),
  `saga_instances` (one live instance per correlation key), `saga_steps`
  (unique `(instance, step, kind)`; the row id is the action idempotency key)
  and `saga_inbox` (dedupe on tenant+company+consumer+event); partial uniques
  hand-written in migration `20261019140000_align_saga_design`.
- `PlanBuilder` merges default + overlay (narrows only: AND-combined
  conditions, overridden timing/retry, optional on / standard off; required can
  never be disabled) and returns `null` for an empty plan.
- `application/expression.ts` is a hand-written safe evaluator (no `eval`):
  literals, property paths, arrays, `==`/`!=`/`>`/`<`/`>=`/`<=`, `!`, `&&`,
  `||`, `in`; plus `{{ }}` rendering and ISO-8601 duration parsing.
- `SagaRouter` (the `SagaInboundPort`) applies the five checks in order and
  drops its own `aggregateType='Saga'` events as a loop guard.
- `SagaEngine` advances the frozen plan: bypass `if`-false steps, consume a
  buffered event for a `WAIT`, otherwise queue the next `DO`; completion emits
  `onComplete` through the outbox; failure compensates completed steps in
  reverse (no undo / past `pivot` ⇒ `FAILED_MANUAL`); cancel compensates or goes
  straight to `CANCELLED`.
- `SagaStepWorker` claims `DO|UNDO` rows (`FOR UPDATE SKIP LOCKED` + lease,
  fairness cap), runs `SagaAction`s and CAS-settles. `SagaScheduler` ticks the
  worker + WAIT-timeout sweep + stale-lease re-queue; hourly inbox cleanup.
- Statuses `RUNNING|WAITING|COMPENSATING|COMPLETED|COMPENSATED|CANCELLED|
FAILED_MANUAL`; ports `FeatureGate`, `CompanySettingsReader`, `SagaAction`
  (+`SAGA_ACTION`), `SagaInboundPort`; fail-closed `EmptyFeatureGate` /
  `EmptyCompanySettingsReader` defaults until an owner wires them.
- Old six-table/command-dispatch saga (never migrated) removed.

## Remaining

### Cross-cutting

- `__testing__/` doubles removed from `src/platform/` (lock, idempotency,
  cache, event bus, messaging, outbox, inbox, notification, context,
  batch-operation, webhook) — moved to `test/support/` so they are no longer
  shipped as platform code. Specs import them via `@test/support/...`.
- Wire the saga to a broker consumer: `SagaInboundPort` is the seam, but
  nothing calls `accept` yet (and no business `SagaAction`s are registered), so
  the saga is inert until an owner wires actions + a consumer.
- Docs: `ARCHITECTURE.md`, `docs/PLATFORM-SERVICES-COMPLETE-FLOW.md`,
  `docs/FLOWCHARTS.md`, `docs/BUSINESS-MODULE-GUIDE.md`,
  `docs/PLATFORM-SERVICE-GUIDE.md` and
  `docs/ARCHITECTURE-BUSINESS-MODULE-PATTERN.md` updated for the 01–08
  removals; the per-service READMEs for events/messaging/outbox/inbox/saga
  rewritten.
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
