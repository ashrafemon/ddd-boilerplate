# Platform Standard

Canonical rules for every module under `src/platform/`. Replaces the `Layout` blocks in
`docs/erp-system/Common Services.xlsx` wherever they disagree (those blocks predate the
inbound/outbound split). Owners: platform maintainers. Violations are caught by
`src/specifications/architecture/platform-shape.spec.ts`.

## 1. Three group folders

| Group                    | Contains                                                                                                                                                                                                                                                                                  |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `platform-common/`       | capabilities with no organization concept (cache, idempotency, lock, outbox, events, messaging, inbox, saga, notification, webhook, scheduler, recurring, batch-operation, import, storage, observability, health, audit, numbering, condition-engine, context, authentication, identity) |
| `platform-organization/` | tenant/company-scoped capabilities (authorization, configuration, tenancy, branch, plant, warehouse, department, entitlements, rules, workflow, reporting, dashboard, localization, custom-fields, sdui-metadata, global-search, automation)                                              |
| `platform-ai/`           | AI capabilities (chat, gateway, mcp, registry)                                                                                                                                                                                                                                            |

Group folders are organizational only. Composition happens in `PlatformModule` (never
`@Global()`; only CLS is global because the transactional plugin requires it).

## 2. Module anatomy

```
src/platform/<group>/<capability>/
├── inbound/
│   ├── ports/       # contracts the outside world drives the module through
│   └── adapters/    # non-HTTP drivers: listeners, workers, schedulers, tickers,
│                    # reconcilers, dispatchers, and the class implementing the inbound port
├── outbound/
│   ├── ports/       # substitutable external dependencies (broker, cache, storage, transport)
│   └── adapters/    # Prisma repositories, BullMQ/S3/SES/SNS/HTTP implementations
├── http/            # the HTTP driver only
│   ├── <capability>.controller.ts
│   ├── *.interceptor.ts / *.decorator.ts / *.guard.ts   (HTTP-only helpers live here)
│   ├── requests/    # nestjs-zod createZodDto + zod schemas
│   └── responses/   # zod response DTOs
├── use-cases/       # one use case per file, <verb>-<noun>.usecase.ts
├── types/           # *.types.ts, *.constants.ts
└── <capability>.module.ts
```

**Hard rules**

1. The module root holds **only** `<capability>.module.ts`. No other file lives at root.
2. A folder exists only when it holds at least one file. No empty skeleton folders.
3. `services/` is allowed **only** for genuine orchestration that composes two or more use
   cases. A class that exists solely to implement a port is an **adapter**, not a service
   (enforced by `src/specifications/architecture/platform-shape.spec.ts`).
4. Direction, not kind: inbound = the outside calls us, outbound = we call the outside.
5. `http/` holds the HTTP driver. Everything else that drives use cases (cron, queue worker,
   broker listener, event listener) goes in `inbound/adapters/`.

## 3. Ports

A port is an `abstract class` used as the DI token. Every port has an adapter that implements it,
and only use cases/services consume it — nobody injects a concrete adapter.

| Kind          | Examples                                                                                                                                                                                                                                                                | Implemented by                                                      |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Inbound port  | `IdempotencyPort`, `CachePort`, `DistributedLockPort`, `OutboxWriterPort`, `MessageQueuePort`, `InProcessEventBus`, `InboxPort`, `BatchOperationHandler`, `ImportHandler`, `NotificationHandler`                                                                        | exactly one `inbound/adapters/*` class that delegates to use cases  |
| Outbound port | `IdempotencyRepositoryPort`, `IdempotencyReplayCachePort`, `CacheStorePort`, `LockLedgerPort`, `LockLeasePort`, `OutboxRepositoryPort`, `InboxRepositoryPort`, `RabbitMqPublisherPort`, `KafkaPublisherPort`, `SqsPublisherPort`, `EventEmitterPort`, `FileStoragePort` | exactly one `outbound/adapters/*` class (Prisma, Redis, S3, broker) |

```
use case ──uses──> outbound port ◁──implements── outbound adapter ──wraps──> infrastructure client
   ▲
   └──driven by── inbound adapter ◁──implements── inbound port
```

- The module binds `{ provide: <Port>, useExisting: <Adapter> }`. Consumers see the port only.
- `use-cases/` must not import from `inbound/adapters/` or `outbound/adapters/`; if a use case needs
  a dependency, that dependency is a port.
- A repository is not exempt: `Prisma<Entity>Repository` implements `<Entity>RepositoryPort`. The old
  `*RepositoryPort` + `useClass` ceremony the standard rejects is the _module wiring_, not the port.

The two cache rules, because they are easy to get wrong:

- `CachePort` caches **data a use case needs**, never an HTTP request/response pair. Request/response
  caching is `@nestjs/cache-manager` (`@HttpCacheable()`), wired in `src/common/http/`; a business
  module wraps `CachePort` in its own outbound port (e.g. `ReadCachePort` with `getOrLoad` /
  `invalidate`) and decides the key, the TTL and the eviction point.
- The cache is disposable: it is never the source of truth, `get` degrading to MISS is always
  correct behaviour, and a failed `set`/`delete` must never roll back a transaction.

### Naming follows the role, not the file's ambition

A class that exists **in order to implement a port is an adapter**. `services/` is reserved for
orchestration that composes two or more use cases (or drives a port on a schedule) — it never
implements a port.

| Role                               | Folder               | File name                                                                      |
| ---------------------------------- | -------------------- | ------------------------------------------------------------------------------ |
| Implements an inbound port         | `inbound/adapters/`  | `<capability>.adapter.ts` (e.g. `idempotency.adapter.ts`)                      |
| Implements an outbound port        | `outbound/adapters/` | `<tech>-<capability>.adapter.ts` / `prisma-<entity>.repository.ts`             |
| Orchestrates ≥2 use cases or a job | `services/`          | `<capability>-<job>.service.ts` (e.g. `idempotency-reconciliation.service.ts`) |

`src/specifications/architecture/platform-shape.spec.ts` fails when:

- a class under `services/` implements any type exported from a `ports/` folder;
- a file under `inbound|outbound/adapters/` is named `*.service.ts`;
- a migrated module has an `inbound/adapters` or `outbound/adapters` file that implements no port of
  that side;
- a migrated module's use cases import `inbound/adapters/` or `outbound/adapters/`.

Known violations are listed in the spec's pending list and must disappear in the change that
migrates the module.

## 4. HTTP contract

- Request DTOs: `nestjs-zod` `createZodDto()` in `http/requests/`, one per file.
- Response DTOs: zod schemas in `http/responses/`, one per file.
- Controllers are thin: parse → call one use case → build the response. No business logic.
- Cross-cutting HTTP behaviour is opt-in per route (`@Idempotent()`, `@HttpCacheable()`,
  `@HttpCacheEvict()`, `@DeviceResponse()`), never global by default.

Two caches exist and they never mix:

|             | Platform `CachePort`                                 | `@nestjs/cache-manager`                        |
| ----------- | ---------------------------------------------------- | ---------------------------------------------- |
| Caches      | a value a use case or query needs                    | the response a controller returned for a URL   |
| Key         | `tenant:company:namespace:resource[:variant]`        | `http:tenant:company:GET:url`                  |
| Lives in    | `platform-common/cache` + a module's `ReadCachePort` | `infrastructure/cache-manager` + `common/http` |
| Evicted by  | the write use case that owns the data                | `@HttpCacheEvict()` on the mutating route      |
| Shared with | background jobs, schedulers, other use cases         | nobody — it is a transport artefact            |
| Enabled by  | `CACHE_ENABLED`                                      | `HTTP_CACHE_ENABLED` (default `false`)         |

A domain value that must stay fresh for a job is a `CachePort` entry; a page a browser may see
30 seconds late is an HTTP entry. Do not key domain data by URL and do not serve a response from
the data cache.

## 5. Configuration

Environment variables are read **only** in `src/config/*.config.ts` (`registerAs`) and exposed
through the typed `ConfigService` facade. Platform modules inject `ConfigService` and call a
getter. **No config file may live inside a platform module folder.** Conditional clients
expose an `isEnabled` getter (`RedisService`, `S3Service`, `SecretsManagerService`,
`PuppeteerService`) instead of branching on env.

## 6. Exceptions

Platform modules throw **NestJS built-in exceptions only**. No `errors/` folder, no custom
error hierarchy, no `DomainException`.

| Situation                                    | Exception                            |
| -------------------------------------------- | ------------------------------------ |
| Resource id does not resolve                 | `NotFoundException` (404)            |
| Unregistered capability/type/channel/handler | `UnprocessableEntityException` (422) |
| Duplicate registration (boot)                | `ConflictException` (409)            |
| Invalid signature / missing credentials      | `UnauthorizedException` (401)        |
| Fan-out or payload over a configured limit   | `UnprocessableEntityException` (422) |
| Programming/config fault that cannot serve   | `InternalServerErrorException` (500) |

Plain `Error` is reserved for invariant violations inside domain code and for boot-time
fail-fast conditions that have no HTTP context.

## 7. Table rules

Every platform-owned table:

- `id String @id @default(uuid()) @db.Uuid`.
- `tenantId String @map("tenant_id") @db.VarChar(100)` and `companyId` when tenant-scoped.
- Async tables carry the full claim contract: `claimToken` (uuid), `claimedAt`, `leaseUntil`,
  `attempts`, `nextAttemptAt` (or `availableAt`), `lastError` (`@db.Text`).
- Natural identity declared as `@@unique([tenantId, companyId, ...])`; never a global unique
  on a tenant-owned key.
- Retry scan index `@@index([status, nextAttemptAt])`.
- Physical names: infrastructure tables (`outbox_messages`, `inbox_messages`,
  `idempotency_keys`, `saga_*`, `distributed_locks`) use **snake_case** `@map`; business tables
  stay camelCase. Hand-written `$queryRaw` must use the physical names.
- Every async table documents its retention window (purge job or partition), and every state
  transition is a CAS on `(id, claimToken|version)`.
- Indexes Prisma cannot express (partial unique indexes) are applied by an explicit SQL step
  after `db:push` and recorded in this document.

### Schema change order

1. Additive columns/enums/indexes (safe, no code rewrite).
2. Dual-write, backfill, dual-read.
3. Flip reads to the new column, then drop the old one one release later.
4. Renames never touch business-facing vocabulary in a single commit; the repository maps
   physical → contract at its own edge.

## 8. Distributed lock — hybrid (decided)

Both layers are used, each with one job:

| Layer                                                                                                                         | Owns                          | Guarantee                               |
| ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | --------------------------------------- |
| Redis `SET NX PX` + owner token (Lua CAS renew/release)                                                                       | the live lease                | fast one-winner-now, fail-closed        |
| `distributed_locks` (unique `lock_key`, monotonic `fencing_token`, `owner_token`, `lease_until`, `acquired_at`, `renewed_at`) | durable fencing + owner trail | a paused/expired owner can never commit |

Acquire, in this order, because the failing path must be the cheap one:

1. Redis `SET NX PX` — refusal is BUSY, no database round-trip.
2. Postgres insert-as-claim `ON CONFLICT (tenant_id, company_id, scope, resource) DO UPDATE
SET fencing_token = fencing_token + 1 … WHERE lease_until IS NULL OR lease_until < now()
RETURNING id, fencing_token` — 0 rows means a live owner is still recorded.
3. If Postgres refuses, hand the Redis lease back by `owner_token` so the two layers never drift.

Release: Redis compare-and-delete, then Postgres `owner_token` CAS clear (both token-checked, so a
fenced-out owner can neither renew nor release). Fenced writes compare `fencing_token >= last seen`
on the row they mutate. `LOCK_DURABLE=false` keeps Redis-only, with the token from an `INCR`
counter — local development only, because a Redis flush resets that sequence.

## 8b. Outbox statuses and columns (workbook-aligned)

`outbox_messages` mirrors the workbook exactly; the repository maps physical →
contract at its edge (`event_name` → `eventType`, `message_id` → `eventId`,
`available_at` → `availableAt`) so the TypeScript envelope stays unchanged.

| Status        | Meaning                                                            |
| ------------- | ------------------------------------------------------------------ |
| `PENDING`     | queued, due once `available_at` has passed                         |
| `PUBLISHING`  | claimed by one dispatcher now; `claimed_at` is the lease           |
| `PUBLISHED`   | broker accepted it — the only status retention may delete          |
| `FAILED`      | permanent failure (broker not configured) — parked for an operator |
| `DEAD_LETTER` | poison message past `max_attempts` — parked forever, never deleted |

Claim = `UPDATE … SET status = 'PUBLISHING', claim_token = …, claimed_at = now(),
attempts = attempts + 1 WHERE id IN (… FOR UPDATE SKIP LOCKED)` and the reclaim
clause accepts `PENDING`/`PUBLISHING` with `claimed_at` older than the lease, so
a crashed dispatcher is retried by the next tick with no reconciler.

Failure routing is deliberate: a transport error returns the row to `PENDING`
with exponential backoff, an exhausted row parks `DEAD_LETTER`, and a missing
broker configuration (`UnsupportedBrokerTargetError`) parks `FAILED` — retrying
cannot make `KAFKA_BROKERS` appear, and calling that a poison message would
mislead whoever debugs it.

## 8c. Inbox statuses and columns (workbook-aligned)

`inbox_messages` is the consumer-side mirror. The identity is
`(tenant_id, company_id, consumer_key, message_id)` with NULLs normalised to `''`
so the unique index still bites; the claim is one `INSERT`, and a duplicate is a
`null` return — never a read-then-write race.

| Status        | Meaning                                                                   |
| ------------- | ------------------------------------------------------------------------- |
| `IN_PROGRESS` | claimed now, or holding a backoff until `next_attempt_at`                 |
| `PROCESSED`   | executed once — every later delivery is a duplicate                       |
| `FAILED`      | permanent failure (`permanent: true`, payload mismatch) — an operator job |
| `SUSPENDED`   | poison past `max_attempts` — never purged by retention                    |

`payload_hash` makes the identity content-aware: a redelivery that reuses a
message id with different content is a contract violation, so the row is parked
`FAILED` instead of executing the wrong payload twice. `hashInboxPayload`
canonicalises with sorted keys, which is what keeps the same logical payload
hashing identically regardless of serialization order.

Complete/fail are CAS-fenced on `claim_token`; losing ownership logs a warning
and never throws, so the broker ACK/NACK path stays safe. The sweep in
`services/inbox-reconciliation.service.ts` composes the reconcile (park poison,
back off the rest) and purge (processed past retention) use cases.

## 9. Saga persistence (implemented)

Module: `platform-common/process-orchestration/saga/`. Four tables, all workbook column names
(physical snake_case, `@map`-ed at the Prisma edge):

| Table                  | Notes                                                                                                    |
| ---------------------- | -------------------------------------------------------------------------------------------------------- |
| `saga_definitions`     | `owner_module` (owning business module), `(saga_key, version)` unique, ACTIVE row per event contract     |
| `saga_company_configs` | one ACTIVE overlay per `(company, saga_key)`; overlays narrow only (`saga_company_overlays` is dropped)  |
| `saga_instances`       | `correlation_id`, frozen `plan`, `cursor`, `waiting_event`, `last_error`, `started_at`/`finished_at`     |
| `saga_steps`           | `attempts`, `event_name`/`event_version` (WAIT), `last_error`, timings, `locked_by`/`lock_until` lease   |
| `saga_inbox`           | dedupe + WAIT buffer: `consumer_key`, `message_id`, `payload_hash`, `headers`, `attempts`, claim columns |

- **One live instance per `(tenant, company, saga_key, correlation_key)`**: Prisma cannot express a
  partial unique index, so the row carries a nullable unique `live_key`
  (`encodeURIComponent(sagaKey)|encodeURIComponent(correlationKey)`); the repository sets it on
  insert and NULLs it on every terminal transition. NULLs never collide, which is exactly
  `WHERE status IN ('RUNNING','WAITING','COMPENSATING')` without a hand-written SQL migration step.
- **Completion events ride the shared outbox** (`aggregateType = 'Saga'`), inside the same
  transaction as the terminal CAS. The router ignores `aggregateType = 'Saga'` envelopes, so an
  `onComplete.emit` can never start another saga. A standalone `saga_outbox` remains the alternative
  if saga traffic ever needs isolation; `PublishPendingBatchUseCase` is already parameterized over a
  repository contract to make that swap cheap.
- Steps are claimed with `FOR UPDATE SKIP LOCKED` + lease and `RETURNING` aliases every snake_case
  column (`$queryRaw` returns physical names; an un-aliased `RETURNING *` yields undefined camelCase
  fields, which silently breaks the fairness cap). Settles are CAS on status; a crashed worker is
  recovered by the sweep (`findStaleRunning` → `reschedule`), not a reconciler.

## 10. Migration staging (per touch)

- `src/specifications/architecture/platform-shape.spec.ts` holds `MIGRATED` (modules conforming) and
  `PENDING` (skip-list). CI is green while both exist.
- Touching a module = migrating it in the same change, moving it from `PENDING` to `MIGRATED`.
- `PENDING` is empty and `MIGRATED` lists the migrated modules (idempotency, cache, locking, outbox,
  messaging, events, inbox, saga-runtime). When the remaining modules
  migrate, the rules flip to global (all platform modules) and the skip-list is deleted in its own
  commit. Phase status: `docs/platform-migration-plan.md`.
- The global rules (`no root files` for migrated modules, `no errors/` folder anywhere) are
  enforced from day one.

## 11. Testing layout

| Kind        | Location                       | Suffix                 |
| ----------- | ------------------------------ | ---------------------- |
| Unit        | beside the source file         | `.spec.ts`             |
| Component   | `specifications/components/`   | `.component-spec.ts`   |
| Integration | `specifications/integrations/` | `.integration-spec.ts` |
| API         | `specifications/api/`          | `.api-spec.ts`         |
| Contract    | `specifications/contracts/`    | `.contract.spec.ts`    |
| Security    | `specifications/security/`     | `.security.spec.ts`    |
| Property    | `specifications/properties/`   | `.property-spec.ts`    |

A module's `specifications/` holds those six folders only — never unit specs, never nested
folders. Unit specs live next to the file they test. A module is not migrated until it carries, at
minimum, one unit spec per use case plus the specification kinds its external surface needs
(api/integration), and a property spec wherever a wide input space meets a simple invariant.

Cross-cutting suites, shared fakes and faker factories live in `src/specifications/`
(`architecture/`, `support/`, `utils/`) — there is no root `test/` folder and no fake inside module
source. Full rules and runners: `docs/testing-business-modules.md`. Enforcement:
`src/specifications/architecture/test-layout.spec.ts`.

## 12. Verification gates

Per phase: `npx tsc --noEmit -p tsconfig.json`, `npm test`, `npm run lint:check`,
`npx jest --config jest.architecture.config.ts`, and the DI boot smoke
(`NestFactory.create(AppModule,{preview:true})` → `init()` → `close()`).
Schema-touching phases additionally run `npm run db:push` +
`npm run test:integration:business` against the Docker stack.
