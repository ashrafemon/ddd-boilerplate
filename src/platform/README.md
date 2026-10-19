# platform/ — services index

Platform = reusable capabilities that **business modules consume through
exported ports/tokens only** (via `imports: [PlatformModule]`). No platform
service may be imported by path (`@platform/<x>/…`) from `src/business` — the
composition root is the only bridge, and ESLint enforces the split.

## Service catalog

| Path | Service module (inject this) | What it gives you |
| --- | --- | --- |
| `context/` | `RequestContextPort`, `PrismaReadPort` | per-request identity/trace + read replica; `@Idempotent`-style context restoration for workers; tenancy trust boundary (`TenancyAuthGuard`) |
| `outbox/` | `OutboxWriterPort` | transactional event publication (SKIP-LOCKED claim, leases, backoff, dead-letter, envelope-stable re-dispatch) |
| `events/` + `messaging/` | `InProcessEventBus`, `MessagePublisher`/`RabbitMq\|Kafka\|SqsPublisher` | in-process bus + broker fan-out (routed by the envelope's `broker` field, never directly) |
| `inbox/` | `InboxPort` | consumer-side dedupe (insert-as-claim + lease + reconciler) — "at-least-once delivery, exactly-once effect" |
| `locking/` | `DistributedLockPort` | cross-instance owner-token leases (Redis, fail-closed) — "one replica now" |
| `idempotency/` | `IdempotencyPort`, `@Idempotent()` | DB-backed duplicate suppression with response replay — "effect exactly once over time" |
| `scheduler/` | `SchedulerPort`, `ScheduledJobHandlerRegistry` | durable TIME wake-ups (CRON/EXTERNAL), BullMQ execution, retry→suspend escalation, admin HTTP |
| `recurring/` | HTTP + `RecurringExecutionPort` | TIME/EVENT document-generation series; claims → outbox → business consumer |
| `batch-operation/` | `BatchOperationHandlerRegistry` + HTTP | Sync/Async bulk transitions; row claims fenced by `claimToken` |
| `import/` | `ImportHandlerRegistry` + HTTP | upload→parse→mapping→validate→execute pipeline over S3 |
| `saga/` | `SagaInboundPort`, `SagaActionRegistry` | company-configurable DO/UNDO orchestration over a frozen plan |
| `numbering/` | `NumberingPort` | race-safe per-tenant document sequences |
| `audit/` | `AuditPort` | same-transaction actor/tenant audit rows (redacted) |
| `configuration/` | `CompanyConfigPort` | company settings resolved from authenticated context |
| `notification/` | `NotificationDispatchPort` | SES/SNS dispatch, graceful channel degradation |
| `webhook/` | `WebhookEventTypeRegistry`, `WebhookInboundSourceRegistry` + HTTP | generic inbound receipt (per-source verify+dedupe) and outbound subscription/dispatch/retry with circuit breaker |
| `observability/` | `LoggerPort`, `MetricsPort`, `ErrorTrackingPort` (+ `GET /api/v1/metrics`) | logs, Prometheus, Sentry seams |
| `storage/` | `FileStoragePort` | private object upload/download + presigned PUT (no public fallback) |
| `cache/` | `CachePort` | Redis/Memcached KV seam |
| `condition-engine/` | `ConditionEvaluator`, `FieldResolverRegistry` | sandboxed AND/OR gates (resolvers registered by field owners) |

Every directory has a `README.md` covering purpose, public API, layout,
**who calls it / how**, data & config, tenancy behaviour, and rules.

## Canonical platform-service anatomy

```
src/platform/<service>/
├── README.md                       MANDATORY (template below)
├── <service>.module.ts             composition: bindings + exports ONLY
├── ports/                          abstract classes = DI tokens (inbound + outbound)
├── usecases/                       one class per capability; @Transactional here; no ports on impls
├── repositories/  | adapters/      Prisma repos / queue-broker-cache adapters
├── http/                           thin controllers + requests/*.request.dto.ts (ONE DTO per file)
├── events/ + registries            (if the service emits domain events or hosts opt-in extension points)
└── <service>-reconciliation*.ts    crons that converge crashed executions (if the service has background states)
```

Rules inherited repo-wide: ports own contracts, adapters own I/O; cross-module
calls only through another module's **exported token**; business opt-in
registries are filled by the **composition root** (`src/bootstrap/configure-*.ts`
bridging pure handlers — owner module classes stay pure `@Module`s; vendor-import
module-side registration is legacy, migrate on touch); platform writes cross the
process boundary solely via `OutboxWriterPort`; every mutating path is
tenant-stamped and read via `TenantScope` (404 for foreign rows); every state
write is CAS/claim-token guarded so redelivery can never double-apply.

> **Platform is independent of business (lint-enforced).** No file under
> `src/platform/**` may import `@business/**` (or a relative `business/**`) — a
> single ESLint regex bans it. Platform owns its OWN event contract: the
> structural `OutboxEvent` interface + `OutboxEventBase` in
> `src/platform/outbox/outbox.types.ts`. Business aggregates still define their
> own `DomainEvent`s (in `@business/shared-business`, which is NOT
> platform-adjacent) — those satisfy the `OutboxEvent` shape structurally and
> flow to the outbox as plain values. **There is no rehydration step and no
> event registry**: the outbox stores the payload verbatim and the same
> envelope is re-emitted in-process on dispatch. Platform's OWN
> completion/cancel events (`ImportJobCompleted`, `BatchOperationJobCompleted`,
> `RecurringOccurrenceRequested`) extend `OutboxEventBase` directly — no
> shared-kernel type, no business coupling.

## Adding a new platform service (checklist)

1. Create the directory above and its `README.md` from the template
   (below). Draft the ports first — they are the product.
2. If it owns tables: `prisma/schema/platform/<service>.prisma` (the schema
   file IS the table contract — there is no migration folder; sync with
   `npm run db:push`), tenant-stamped columns where scoped.
3. Register config under `src/config/<service>.config.ts` + `ConfigService`
   getter (defaults mirror the config file).
4. Wire `<Service>Module` into `src/platform/platform.module.ts` (imports +
   exports) — consumers get it through `PlatformModule`.
5. Consume existing primitives (`locking`, `idempotency`, `outbox`,
   `audit`, `numbering`, `context.run` in workers) instead of re-inventing.
   Full file-by-file templates + the naming map + the acceptance checklist:
   `docs/PLATFORM-SERVICE-GUIDE.md`.
6. `lint:check` (boundary rules pass), unit tests with in-memory port fakes,
   update `ARCHITECTURE.md` §9 catalog + this index table.
7. If business modules can plug in: expose a registry, document the
   composition-root bridge row pattern, and fail fast on misuse.

## Per-module README template

```
# platform/<name> — <one-line role>
> What problem it removes from business code.
## What it does            (mechanism; concurrency/ delivery semantics)
## Public API              (tokens/decorators with signatures + usage snippet)
## Layout                  (file map with one-line roles)
## Who calls it / how called   (table: caller → surface; "no external consumers" is valid and honest)
## Data & config           (tables, migration, env vars, ConfigService getter)
## Tenancy behaviour       (scope stamping/resolution; multi-mode expectations)
## Rules & gotchas         (invariants, degradation paths, do-not list)
```
