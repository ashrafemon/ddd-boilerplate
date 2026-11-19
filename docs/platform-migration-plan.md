# Platform Migration Plan — Phases, Status, and Remaining Work

This is the execution plan for reshaping `src/platform` into the hexagonal
inbound/outbound anatomy defined in [`platform-standard.md`](./platform-standard.md),
and for aligning the platform database tables with the workbook
`docs/erp-system/Common Services.xlsx` (`DB Tables` sheet).

Read this before starting a platform module: it says what is done, what is next, and
what "done" means for each phase.

- **Shape rules**: `docs/platform-standard.md` (§2 anatomy, §3 ports, §7 tables, §10 staging).
- **Test rules**: `docs/testing-business-modules.md` (§ unit beside file, six `specifications/` folders).
- **Enforcement**: `src/specifications/architecture/platform-shape.spec.ts` (`MIGRATED` list).

Status legend: ✅ done · 🚧 in progress · ⬜ not started.

## Phase overview

| Phase | Goal                                                       | Modules                                                                                                                        | Status |
| ----- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------ |
| 0     | Publish the standard + enforcement scaffolding             | `platform-standard.md`, architecture specs, `test:architecture`                                                                | ✅     |
| 1     | Pilot the anatomy on the two smallest capabilities         | `idempotency`, `cache`                                                                                                         | ✅     |
| 2     | Migrate the event spine (the modules that call each other) | `locking`, `outbox`, `messaging`, `events`, `inbox`                                                                            | ✅     |
| 3     | Migrate the saga runtime + finish its persistence          | `saga`, `saga.prisma`                                                                                    | ✅     |
| 4     | Migrate the HTTP-facing capabilities                       | `numbering` ✅, `audit` ✅, `health` ✅, then `import`, `notification`, `webhook`, `scheduler`, `recurring`, `batch-operation` | 🚧     |
| 5     | Finish the contract-side rename work                       | business listeners                                                                                                             | 🚧     |
| 6     | Flip enforcement from staged to global                     | architecture specs, `eslint.config.mjs`, `docs/architecture.md`                                                                | ⬜     |
| 7     | Build out the ~40 scaffold capabilities                    | `platform-ai/*`, `platform-organization/*`, remaining `platform-common/*`                                                      | ⬜     |

## Phase 0 — Standard and enforcement ✅

Published `docs/platform-standard.md` (12 sections: group folders, anatomy, ports,
HTTP contract, configuration, exceptions, table rules, lock, outbox, inbox, saga,
staging, testing, gates).

Exit criteria met:

- `platform-shape.spec.ts` exists and is part of `npm run test:architecture`.
- Global rules are enforced from day one: no `errors/` folder, no `*.errors.ts`, no
  module-local `*.config.ts` (env lives in `src/config`), no import of the retired
  `platform-common/errors` hierarchy.
- `MIGRATED` (strict anatomy) starts empty; `PENDING_PORT_SERVICES` records the
  "port implementation living in `services/`" debt, shrink-only.

## Phase 1 — Pilot: `idempotency` + `cache` ✅

`idempotency` was chosen because it has claim/lease/CAS semantics that stress the
port split; `cache` because it is small and external (Redis).

Delivered:

- `idempotency`: `inbound/{ports,adapters}`, `outbound/{ports,adapters}`,
  `http/`, `use-cases/`, `types/`; `errors/` removed (20 throw sites → NestJS
  built-ins); `leaseUntil`/`lastError`, `FAILED`/`SUSPENDED` statuses, `(status, lease_until)`
  index; `InboundService` → `IdempotencyAdapter`; reconciliation moved to `services/`.
- `cache`: `CacheAdapter` (inbound), `RedisCacheAdapter` (outbound, `CacheStorePort`),
  use cases; **the HTTP response-cache layer was removed from the platform** — platform
  cache is a data cache only. HTTP request/response caching is `@nestjs/cache-manager`
  (`src/infrastructure/cache-manager`, `src/common/http/interceptors/http-cache.interceptor.ts`).
- Naming rule recorded (standard §3): a class that implements a port is an adapter;
  `services/` is orchestration only.
- Two architecture tests added (adapters implement ports; adapter files are named
  `<capability>.adapter.ts`).

## Phase 2 — Event spine ✅

Modules: `locking`, `outbox`, `messaging`, `events`, `inbox`.

| Module      | Inbound port(s)                                  | Outbound port(s)                                                  | `services/`                                  |
| ----------- | ------------------------------------------------ | ----------------------------------------------------------------- | -------------------------------------------- |
| `locking`   | `DistributedLockPort`                            | `LockLedgerPort`, `LockLeasePort`                                 | —                                            |
| `outbox`    | `OutboxWriterPort`, `GenericOutboxPublisherPort` | `OutboxRepositoryPort`                                            | `OutboxDispatcherService` (poll + retention) |
| `messaging` | `MessageQueuePort`, `MessageConsumerPort`        | `RabbitMqPublisherPort`                                           | —                                            |
| `events`    | `InProcessEventBus`                              | `EventEmitterPort`                                                | —                                            |
| `inbox`     | `InboxPort`                                      | `InboxRepositoryPort`                                             | `InboxReconciliationService` (sweep + purge) |

Exit criteria met:

- `PENDING_PORT_SERVICES` is **empty** — no port implementation remains in `services/`.
- Every declared port has an adapter that implements it (checked per port).
- Use cases import ports only; no use case imports an adapter.
- Every module carries: one unit spec per use case, an integration spec against real
  Postgres where a ledger is involved, and a property spec wherever a key/hash
  builder meets an unbounded input space.
- Property specs are hostile: `fast-check` generators include `:`, `%`, `/`, `?`,
  quotes and empty strings — the alphabet that broke the first cache/idempotency key
  builders (fixed by `encodeURIComponent` on every segment).

## Phase 3 — Saga runtime ✅

`src/platform/platform-common/saga/` is migrated; it was the last module
with the legacy shape. `ports/`, `repositories/`, `application/`, `workers/`, `events/`,
`adapters/` and `saga.scheduler.ts` are gone.

### 3a. Schema (applied)

| Decision                        | Result                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `saga_company_overlays`         | **removed** (2026-11): no per-company narrowing source is implemented, so the table, its repository port/adapter and the overlay fetch are gone; `saga_instances.config_id` stays as a reserved always-NULL workbook column and `BuildSagaPlanUseCase` still accepts an `overlay` argument as a future seam |
| `saga_definitions.owner_module` | added — the owning business module                                                                                                                                                                                                                                                                                                          |
| `saga_steps`                    | `attempts`, `event_name`/`event_version` (WAIT rows), `last_error`, `started_at`/`finished_at`                                                                                                                                                                                                                                              |
| `saga_instances`                | `correlation_id`, `last_error`, `started_at`/`finished_at`                                                                                                                                                                                                                                                                                  |
| live-instance uniqueness        | nullable unique `live_key` = `encodeURIComponent(sagaKey)\|encodeURIComponent(correlationKey)`, set on insert and NULLed on every terminal transition — the portable equivalent of `WHERE status IN ('RUNNING','WAITING','COMPENSATING')`, because Prisma cannot express a partial unique index and schema sync would drop a hand-written one |
| `saga_inbox`                    | workbook columns: `consumer_key`, `message_id`, `payload_hash`, `headers`, `attempts`, `claim_token`/`claimed_at`, `processed_at`, `next_attempt_at`, `last_error`                                                                                                                                                                          |
| completion events               | appended to the saga's own `saga_outbox` ledger inside the terminal CAS, published by `SagaOutboxDispatcherService` (own cadence + retention); the router still ignores `aggregateType = 'Saga'` envelopes, so `onComplete.emit` can never start another saga |

### 3b. Shape (applied)

Split (2026-11) into three modules, one per ledger boundary:

```
saga/                      engine + definitions/instances/steps
├── saga.module.ts         imports SagaOutboxModule + SagaInboxModule, re-exports neither
├── inbound/{ports/saga-inbound.port.ts, adapters/saga-router.adapter.ts}
├── outbound/ports/  saga-{definition,instance,step}.repository.port.ts
│                    saga-action.port.ts (token + resolver), feature-gate.port.ts,
│                    company-settings.port.ts
├── outbound/adapters/ prisma-saga-{definition,instance,step}.repository.ts,
│                      saga-action.registry.ts, empty-*.adapter.ts
├── use-cases/  build-saga-plan, accept-saga-event, start-saga, advance-saga, complete-saga,
│               cancel-saga, start-compensation, settle-step-success, settle-step-failure,
│               execute-saga-step, expire-wait-step, buffer-saga-event, register-saga-definition
├── services/   saga-step-worker.service.ts, saga-sweep.service.ts
└── types/      saga.types.ts, saga-expression.ts, saga-scope.ts, saga-emitted.event.ts,
                saga-definition.{document,parser}.ts, definitions/goods-receipt.example.ts

saga-outbox/               the `saga_outbox` publication ledger
├── saga-outbox.module.ts  exports SagaOutboxWriterPort only
├── inbound/{ports/saga-outbox-writer.port.ts, adapters/saga-outbox-writer.adapter.ts}
├── outbound/{ports/saga-outbox.repository.port.ts, adapters/prisma-saga-outbox.repository.ts}
├── use-cases/  append-saga-outbox-event, publish-saga-outbox-batch, purge-published-saga-outbox
├── services/   saga-outbox-dispatcher.service.ts (tick + cleanup-saga-outbox)
└── specifications/integrations/saga-outbox-ledger.integration-spec.ts

saga-inbox/                the `saga_inbox` dedupe/buffer ledger
├── saga-inbox.module.ts   exports SagaInboxPort only
├── inbound/{ports/saga-inbox.port.ts, adapters/saga-inbox.adapter.ts}
├── outbound/{ports/saga-inbox.repository.port.ts, adapters/prisma-saga-inbox.repository.ts}
├── use-cases/  buffer-saga-inbox-event, list-buffered-saga-events, mark-saga-event-consumed,
│               ignore-buffered-saga-events, purge-saga-inbox
├── services/   saga-inbox-retention.service.ts (cleanup-saga-inbox)
└── types/      saga-inbox.types.ts
```

The engine now consumes both ledgers through ports only (`SagaInboxPort.buffer/
listBuffered/markConsumed/ignoreBuffered`, `SagaOutboxWriterPort.append`); WAIT
retention moved out of the sweep, and a skipped WAIT parks its still-buffered
deliveries as `IGNORED` with a reason instead of leaving rows BUFFERED forever.

`SagaRouterAdapter implements SagaInboundPort`; `SagaActionRegistry implements
SagaActionResolverPort`; the engine's hooks became settle/compensate/advance use cases, so no state
machine hides inside a service and every use case injects ports only.

### 3c. Tests (applied)

- Unit (78): plan builder 7, advance 8, complete 3, start 2, cancel 3, compensation 4, settle
  success 5, settle failure 3, execute step 7, expire wait 3, buffer 2, accept/routing 7, action
  registry 3, scope helpers 4, expression evaluator 11, sweep 5.
- Integration (real Postgres): live-key uniqueness + terminal release, version CAS, SKIP LOCKED
  claim + stale-lease requeue, fairness-cap overflow release, retry requeue + WAIT scan, inbox dedupe.
- Property: `buildLiveKey` injectivity under a hostile alphabet.

**Result**: `saga` in `MIGRATED`; no `ports/`/`repositories/`/`application/`/`workers/` folders
remain under `src/platform`. The claim SQL was found to be broken during this phase
(`RETURNING *` hands `$queryRaw` physical snake_case names, so `lockedBy`/`companyId` were
`undefined` and the fairness cap bucketed every row together) — fixed with explicit aliases and
covered by the integration spec.

## Phase 4 — HTTP-facing capabilities 🚧

Each of these owns a public surface (controllers or HTTP-adjacent ports), so the
migration adds `http/requests` + `http/responses` (zod via `createZodDto`) in addition
to the anatomy. Order (smallest blast radius first):

- ✅ `numbering` — `NumberingPort` inbound + `NumberSequenceRepositoryPort` outbound,
  `NextDocumentNumberUseCase` owns the company scope and formatting. The durable key is
  `buildSequenceKey(company, series)` with both segments percent-encoded: a raw `company:series`
  join let `("a:b", "c")` and `("a", "b:c")` share one counter (found by the property spec).
  `currentValue` is a BIGINT — formatted as text, never through `Number()`.
- ✅ `audit` — `AuditPort` inbound + `AuditLogRepositoryPort` outbound,
  `RecordAuditEntryUseCase` resolves actor/tenant/request ids from CLS and redacts
  credential-shaped fields (pure `redactChanges` in `types/`, unit-tested).
- ✅ `health` — `HealthPort` inbound + `HealthAdapter` (+ `types/health.types.ts`). Inbound-only
  by design: it aggregates infrastructure probes, persists nothing, so it is the one module on the
  architecture spec's `INBOUND_ONLY` list.
- ⬜ `import` — 42 files, has `@ImportOptIn` registry, handler + job + row model.
- ⬜ `notification` — 42 files, channel registry, SES/SNS adapters already exist.
- ⬜ `webhook` — 40 files, outbound delivery ledger + inbound receiver, signature checks
  (`401`), retries in `services/`.
- ⬜ `scheduler` — 35 files, due-job dispatch, already consumes `DistributedLockPort`.
- ⬜ `recurring` — 26 files, occurrence generation + margin/version rules.
- ⬜ `batch-operation` — 32 files, `@BatchOperationOptIn` registry.

Exit criteria per module: anatomy holds, `http/responses` DTOs added where a controller
exists, `MIGRATED` gains the module, workbook table aligned if one exists.

## Phase 5 — Rename completion 🚧

Every platform ledger now matches the workbook `DB Tables` sheet (`idempotency_keys` with
`idempotency_key`, `distributed_locks`, `outbox_messages`, `inbox_messages`, `saga_definitions`,
`saga_instances`, `saga_steps`, `saga_outbox`, `saga_inbox`; `saga_company_overlays` intentionally not
implemented). Remaining is
the contract-side rename, which touches business code:

| Item               | Remaining work                                                                                                                                                                                                  |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Business listeners | `eventType` → `eventName` (205 refs), `eventId` → `messageId` (128), `nextRetryAt` → `availableAt` (44) — **dual-read** (write both, read the new one, then drop) in the same change that touches each listener |

## Phase 6 — Enforcement flip ⬜

When Phase 4 empties the legacy list:

1. Delete `MIGRATED` from `platform-shape.spec.ts` and apply the anatomy to every
   platform module (the `it.each(MIGRATED)` cases become a single walk of `src/platform`).
2. Delete `PENDING_PORT_SERVICES` (already empty) and its regression test.
3. Fix the documentation drift recorded below.

## Phase 7 — Build out the scaffolds ⬜

~40 modules are empty `@Module({})` shells (`platform-ai/*`, `platform-organization/*`,
`platform-common/{tenancy,identity,feature-flag,secret-management,storage,...}`).
Each is built on the frozen template in `docs/generate-platform-service.md`:
`inbound/{ports,adapters}`, `outbound/{ports,adapters}`, `use-cases/`, `types/`,
`<capability>.module.ts`, plus unit spec per file and one specification kind for its
external surface.

## Module ledger

Shape: `legacy` = loose files at the module root or `ports/`/`repositories/`/`usecases/`
folders; `hex` = migrated anatomy. Specs counts exclude integration/api specs.

| Module                             | Files | Specs | Shape  | Workbook table              | Next action     |
| ---------------------------------- | ----- | ----- | ------ | --------------------------- | --------------- |
| `platform-common/idempotency`      | 15    | 12    | hex    | `idempotency_keys` ✅       | —               |
| `platform-common/cache`            | 10    | 13    | hex    | —                           | —               |
| `platform-common/locking`          | 12    | 11    | hex    | `distributed_locks` ✅      | —               |
| `platform-common/outbox`           | 16    | 15    | hex    | `outbox_messages` ✅        | Phase 5 renames |
| `platform-common/messaging`        | 10    | 12    | hex    | —                           | —               |
| `platform-common/events`           | 7     | 4     | hex    | —                           | —               |
| `platform-common/inbox`            | 14    | 21    | hex    | `inbox_messages` ✅         | Phase 5 renames |
| `saga`       | 27    | 20    | hex    | `saga_*` ✅                 | Phase 5 renames |
| `platform-common/import`           | 42    | 0     | legacy | `import_jobs`/rows          | Phase 4         |
| `platform-common/notification`     | 42    | 0     | legacy | `notifications`/templates   | Phase 4         |
| `platform-common/webhook`          | 40    | 0     | legacy | `webhook_*`                 | Phase 4         |
| `platform-common/scheduler`        | 35    | 0     | legacy | `scheduled_jobs`            | Phase 4         |
| `platform-common/batch-operation`  | 32    | 0     | legacy | `batch_operations`          | Phase 4         |
| `platform-common/recurring`        | 26    | 0     | legacy | `recurring_*`               | Phase 4         |
| `platform-common/context`          | 7     | 0     | legacy | —                           | Phase 4         |
| `platform-common/condition-engine` | 6     | 0     | legacy | `expressions`               | Phase 4         |
| `platform-common/health`           | 6     | 5     | hex    | —                           | Phase 4 (done)  |
| `platform-common/numbering`        | 8     | 4     | hex    | `document_number_sequences` | Phase 4 (done)  |
| `platform-common/audit`            | 8     | 6     | hex    | `audit_logs`                | Phase 4 (done)  |
| `platform-common/observability`    | 8     | 0     | legacy | —                           | Phase 4         |

Every migrated module has at least one unit spec per source file that carries logic, plus
integration specs where a ledger exists.

## Cross-cutting debt (tracked, not blocking)

- `docs/architecture.md` still contains ~90 lines of pasted source — replace with a
  pointer to `platform-standard.md`.
- `eslint.config.mjs` `businessModules` list is stale relative to the six real modules.
- 17 comments reference bootstrap files removed in the earlier reshape.
- `.env.example` has a duplicated `LOG_LEVEL`.
- `docs/erp-system/` is an untracked embedded git repo — never commit it.

## Commit log (this sequence)

| Commit    | Content                                                                              |
| --------- | ------------------------------------------------------------------------------------ |
| `0e8e62a` | hexagonal `cache` + `idempotency`                                                    |
| `aecf668` | durable hybrid lock                                                                  |
| `47f6a9b` | outbox anatomy + dispatcher                                                          |
| `f1e95e0` | messaging ports per broker                                                           |
| `534e967` | events in-process bus                                                                |
| `c7f374b` | outbox workbook alignment (`PUBLISHING`/`FAILED`, `message_id`, `aggregate_version`) |
| `9847d02` | inbox anatomy + workbook alignment                                                   |

## Verification battery (per phase)

```bash
npx tsc --noEmit -p tsconfig.json
npm test
npm run lint:check
npm run format:check
npx jest --config jest.architecture.config.ts
npm run test:specifications:platform
npm run build
NODE_ENV=test node -e "(async()=>{const{NestFactory}=require('@nestjs/core');const{AppModule}=require('./dist/app.module.js');const a=await NestFactory.create(AppModule,{preview:true});await a.init();await a.close();})()"
```

Schema-touching phases additionally run `npm run db:migrate`, `npx prisma generate` and
the platform integration specs against the local Docker stack.
