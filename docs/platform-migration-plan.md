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

| Phase | Goal                                                       | Modules                                                                                                          | Status |
| ----- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------ |
| 0     | Publish the standard + enforcement scaffolding             | `platform-standard.md`, architecture specs, `test:architecture`                                                  | ✅     |
| 1     | Pilot the anatomy on the two smallest capabilities         | `idempotency`, `cache`                                                                                           | ✅     |
| 2     | Migrate the event spine (the modules that call each other) | `locking`, `outbox`, `messaging`, `events`, `inbox`                                                              | ✅     |
| 3     | Migrate the saga runtime + finish its persistence          | `process-orchestration/saga-runtime`, `saga.prisma`                                                              | 🚧     |
| 4     | Migrate the HTTP-facing capabilities                       | `numbering`, `audit`, `health`, `import`, `notification`, `webhook`, `scheduler`, `recurring`, `batch-operation` | ⬜     |
| 5     | Finish the workbook column/rename work                     | `outbox`, `inbox`, `saga`, business listeners                                                                    | 🚧     |
| 6     | Flip enforcement from staged to global                     | architecture specs, `eslint.config.mjs`, `docs/architecture.md`                                                  | ⬜     |
| 7     | Build out the ~40 scaffold capabilities                    | `platform-ai/*`, `platform-organization/*`, remaining `platform-common/*`                                        | ⬜     |

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
| `messaging` | `MessageQueuePort`                               | `RabbitMqPublisherPort`, `KafkaPublisherPort`, `SqsPublisherPort` | —                                            |
| `events`    | `InProcessEventBus`                              | `EventEmitterPort`                                                | —                                            |
| `inbox`     | `InboxPort`                                      | `InboxRepositoryPort`                                             | `InboxReconciliationService` (sweep + purge) |

Exit criteria met:

- `PENDING_PORT_SERVICES` is **empty** — no port implementation remains in `services/`.
- Every declared port has an adapter that implements it (checked per port, so driver
  adapters such as `KafkaConsumerHost` may implement none).
- Use cases import ports only; no use case imports an adapter.
- Every module carries: one unit spec per use case, an integration spec against real
  Postgres where a ledger is involved, and a property spec wherever a key/hash
  builder meets an unbounded input space.
- Property specs are hostile: `fast-check` generators include `:`, `%`, `/`, `?`,
  quotes and empty strings — the alphabet that broke the first cache/idempotency key
  builders (fixed by `encodeURIComponent` on every segment).

## Phase 3 — Saga runtime 🚧 (next)

`src/platform/platform-common/process-orchestration/saga-runtime/` is the last module
with the legacy shape. It still has `ports/`, `repositories/`, `application/`,
`workers/`, `events/`, `adapters/*.reader.ts`, `saga.scheduler.ts`.

### 3a. Schema decisions (blocking — agree before code)

| Decision                        | Choice                                                                                                                                                                                              |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `saga_company_overlays`         | **dropped**; company overrides live in `saga_company_configs` (versioned, one ACTIVE row per company/saga)                                                                                          |
| Saga outbox/inbox               | **standalone** `saga_outbox` / `saga_inbox`; the saga never writes the shared tables                                                                                                                |
| Publisher reuse                 | one `PublishPendingBatchUseCase`, parameterized over a repository contract, serves both outboxes                                                                                                    |
| `saga_definitions.owner_module` | added — the owning business module, used for authorization and discovery de-duplication                                                                                                             |
| `saga_steps`                    | add `started_at`/`finished_at` (timings) and keep `event_name` for wait steps                                                                                                                       |
| `saga_instances`                | add `started_at`/`finished_at`/`last_error`; one live instance per `(tenant, company, saga_key, correlation_key)` via a **partial unique index** (raw SQL, `WHERE status IN ('RUNNING','WAITING')`) |

### 3b. Shape normalization

- `ports/*` → `inbound/ports/*` (`SagaInboundPort`, `SagaActionPort`, `FeatureGatePort`,
  `CompanySettingsPort`) and `outbound/ports/*` (`SagaRepositoryPort`).
- `repositories/prisma-saga.repository.ts` → `outbound/adapters/`, `implements SagaRepositoryPort`.
- `adapters/empty-*-*.reader.ts` → `outbound/adapters/` implementing their ports.
- `application/{saga-engine,saga-router,plan-builder,expression,saga-action.registry}.ts`
  → `services/` (orchestration of use cases) — no business rules hidden there.
- `workers/step-worker.ts` → `services/step-worker.service.ts`.
- `events/saga-emitted.event.ts` → `types/`.
- `saga.scheduler.ts` → merged into the dispatcher service (one cron owner per capability).

### 3c. Tests

- Unit: engine (step advance, wait, cancel, compensation), router, plan builder,
  expression evaluator, step worker.
- Integration: claim/lease on `saga_steps`, partial unique index on live instances,
  inbox dedupe, compensation ordering, restart after crash.
- Property: expression parser / correlation-key builder under the hostile alphabet.

**Exit criteria**: `saga-runtime` in `MIGRATED`, workbook columns complete, no
`ports/`/`repositories/`/`application/` folders left in the platform tree.

## Phase 4 — HTTP-facing capabilities ⬜

Each of these owns a public surface (controllers or HTTP-adjacent ports), so the
migration adds `http/requests` + `http/responses` (zod via `createZodDto`) in addition
to the anatomy. Suggested order (smallest blast radius first):

1. `numbering` — exercises `fencingToken` end to end (number blocks are leased); smallest
   module with a port, a repository and a unique constraint.
2. `audit` — `AuditPort` inbound, `AuditRepositoryPort` outbound, retention in `services/`.
3. `health` — `HealthCheckAdapter` already aggregates every client; shape it as
   `inbound/adapters/health.adapter.ts` + `inbound/ports/health.port.ts`.
4. `import` — 42 files, has `@ImportOptIn` registry, handler + job + row model.
5. `notification` — 42 files, channel registry, SES/SNS adapters already exist.
6. `webhook` — 40 files, outbound delivery ledger + inbound receiver, signature checks
   (`401`), retries in `services/`.
7. `scheduler` — 35 files, due-job dispatch, already consumes `DistributedLockPort`.
8. `recurring` — 26 files, occurrence generation + margin/version rules.
9. `batch-operation` — 32 files, `@BatchOperationOptIn` registry.

Exit criteria per module: anatomy holds, `http/responses` DTOs added where a controller
exists, `MIGRATED` gains the module, workbook table aligned if one exists.

## Phase 5 — Workbook column completion 🚧

`outbox` and `inbox` are aligned. Remaining:

| Table              | Remaining work                                                                                                                                                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `outbox_messages`  | ✅ all workbook columns + `PENDING/PUBLISHING/PUBLISHED/FAILED/DEAD_LETTER`                                                                                                                                          |
| `inbox_messages`   | ✅ all workbook columns + `IN_PROGRESS/PROCESSED/FAILED/SUSPENDED`                                                                                                                                                   |
| `saga_*`           | Phase 3a decisions; partial unique index                                                                                                                                                                             |
| Business listeners | `eventType` → `eventName` rename (205 refs), `eventId` → `messageId` (128), `nextRetryAt` → `availableAt` (44) — do it **dual-read** (write both, read new, then drop) in the same change that touches each listener |

Rename blast radius is large, so it is a phase of its own; every step keeps
`tsc`/tests green and lands as its own commit.

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

| Module                               | Files | Specs | Shape  | Workbook table              | Next action     |
| ------------------------------------ | ----- | ----- | ------ | --------------------------- | --------------- |
| `platform-common/idempotency`        | 15    | 12    | hex    | `idempotency_keys` ✅       | —               |
| `platform-common/cache`              | 10    | 13    | hex    | —                           | —               |
| `platform-common/locking`            | 12    | 11    | hex    | `distributed_locks` ✅      | —               |
| `platform-common/outbox`             | 16    | 15    | hex    | `outbox_messages` ✅        | Phase 5 renames |
| `platform-common/messaging`          | 10    | 12    | hex    | —                           | —               |
| `platform-common/events`             | 7     | 4     | hex    | —                           | —               |
| `platform-common/inbox`              | 14    | 21    | hex    | `inbox_messages` ✅         | Phase 5 renames |
| `process-orchestration/saga-runtime` | 17    | 0     | legacy | `saga_*` ⚠️                 | Phase 3         |
| `platform-common/import`             | 42    | 0     | legacy | `import_jobs`/rows          | Phase 4         |
| `platform-common/notification`       | 42    | 0     | legacy | `notifications`/templates   | Phase 4         |
| `platform-common/webhook`            | 40    | 0     | legacy | `webhook_*`                 | Phase 4         |
| `platform-common/scheduler`          | 35    | 0     | legacy | `scheduled_jobs`            | Phase 4         |
| `platform-common/batch-operation`    | 32    | 0     | legacy | `batch_operations`          | Phase 4         |
| `platform-common/recurring`          | 26    | 0     | legacy | `recurring_*`               | Phase 4         |
| `platform-common/context`            | 7     | 0     | legacy | —                           | Phase 4         |
| `platform-common/condition-engine`   | 6     | 0     | legacy | `expressions`               | Phase 4         |
| `platform-common/health`             | 4     | 0     | legacy | —                           | Phase 4         |
| `platform-common/numbering`          | 3     | 0     | legacy | `document_number_sequences` | Phase 4 (first) |
| `platform-common/audit`              | 3     | 0     | legacy | —                           | Phase 4         |
| `platform-common/observability`      | 8     | 0     | legacy | —                           | Phase 4         |

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

Schema-touching phases additionally run `npm run db:push`, `npx prisma generate` and
the platform integration specs against the local Docker stack.
