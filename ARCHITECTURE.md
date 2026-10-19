# ERP Boilerplate — Architecture

A production-oriented **NestJS 11 + TypeScript + PostgreSQL (Prisma 7)** ERP backend built as
an **event-driven modular monolith**. The codebase applies **Domain-Driven Design (DDD)**,
**Hexagonal Architecture (Ports & Adapters)**, **Clean Architecture** and a lightweight
**CQRS-style split** between command and query paths.

Key pillars:

- **Strict layer separation** — domain knows nothing about NestJS, Prisma, or any broker.
- **Ports & Adapters** — every external dependency (DB, brokers, cache, storage, email,
  metrics, company config, outbox) is behind a port (abstract class used as DI token), bound
  to an adapter in a composition-root module.
- **Transactional outbox** — integration events are persisted atomically with the aggregate
  change and published by a scheduler; no events are lost and nothing publishes inside the
  business transaction.
- **In-process event bus + integration event routing** — domain events drive local reactions;
  a routing policy decides which broker(s) receive each event.
- **Module-to-module contracts** — aggregates talk to each other through `public/` port
  contracts implemented by facades, injected **directly** through the Nest container,
  never by importing another module's internals.
- **Device-aware responses** — one controller, two response shapes (`web` full payload,
  `mobile` minimal payload) selected by the `x-device-type` header and validated with Zod.
- **Architecture enforced by ESLint** (`no-restricted-imports` in `eslint.config.mjs`).

This document is the single source of truth for the design. If you change the rules here,
update `eslint.config.mjs` and vice versa.

For the runtime **flows** (request lifecycles, module-to-module contracts, platform service
internals, opt-in registrations) see [`docs/FLOWCHARTS.md`](docs/FLOWCHARTS.md).

---

## Table of Contents

1. [Top-Level Folder Map](#1-top-level-folder-map)
2. [Layers and Responsibilities](#2-layers-and-responsibilities)
3. [Business Module Anatomy](#3-business-module-anatomy)
4. [Dependency Direction & ESLint Enforcement](#4-dependency-direction--eslint-enforcement)
5. [Ports & Adapters (Command / Query / Integration)](#5-ports--adapters-command--query--integration)
6. [Cross-Module Communication](#6-cross-module-communication)
7. [Domains / Aggregates](#7-domains--aggregates)
8. [Outbox, Events & Messaging](#8-outbox-events--messaging)
9. [Platform Layer](#9-platform-layer)
10. [Infrastructure Layer](#10-infrastructure-layer)
11. [Persistence & Data Model](#11-persistence--data-model)
12. [HTTP, Validation, Error Handling](#12-http-validation-error-handling)
13. [Observability & Security](#13-observability--security)
14. [Testing Strategy](#14-testing-strategy)
15. [Creating a New Business Module](#15-creating-a-new-business-module)
16. [Commands](#16-commands)

---

## 1. Top-Level Folder Map

```text
src/
├── app.module.ts            # root composition root + global interceptors/filter/pipe
├── main.ts                  # entry point, calls bootstrap()
├── config/                  # .env-driven typed configuration blocks + ConfigService facade
├── shared-kernel/           # technical NestJS concerns: filters, interceptors, pipes,
│                            # decorators, exceptions, types (device context, pagination)
├── bootstrap/               # app bootstrap steps (sentry, security, cors, http, swagger, ...)
├── infrastructure/          # third-party client init ONLY (Prisma, brokers, cache, AWS, CLS)
├── platform/                # services built on those clients, exposed as ports
│                            # (outbox, events, messaging, context (incl. PrismaReadPort),
│                            #  cache, audit, numbering, configuration, notification,
│                            #  observability, storage, condition-engine, locking,
│                            #  idempotency, scheduler, recurring, batch-operation, import)
├── generated/               # Prisma-generated client (DO NOT EDIT; `@prisma/client` alias)
└── business/
    ├── shared-business/     # framework-independent domain primitives + registries
    ├── party/vendor/                    # Vendor aggregate       (context: party)
    ├── procurement/product/             # Product aggregate      (context: procurement)
    ├── procurement/purchase-order/      # PurchaseOrder aggregate (context: procurement)
    ├── procurement/good-receipt-note/   # GoodReceiptNote aggregate (context: procurement)
    └── sales/invoice/                   # Invoice aggregate       (context: sales)
```

Module aliases (see `tsconfig.json` + Jest `moduleNameMapper` in `package.json`):

| Alias               | Path                      |
| ------------------- | ------------------------- |
| `@config/*`         | `src/config/*`            |
| `@shared-kernel/*`  | `src/shared-kernel/*`     |
| `@bootstrap/*`      | `src/bootstrap/*`         |
| `@infrastructure/*` | `src/infrastructure/*`    |
| `@platform/*`       | `src/platform/*`          |
| `@business/*`       | `src/business/*`          |
| `@test/*`           | `test/*`                  |
| `@prisma/client`    | `src/generated/client.ts` |

---

## 2. Layers and Responsibilities

### config/

The only place that reads `process.env`. Each concern is a typed `registerAs` block loaded by
`ConfigModule` (which is `@Global`):

- `app.config.ts` — env, name, port/host, log level, CORS origins, app/API URLs, Swagger
  metadata (title/description/version/path)
- `auth.config.ts` — JWT access/refresh secrets + TTLs, settings encryption key
- `database.config.ts` — driver + `postgres.url` (`DATABASE_URL`) / `postgres.readUrl`
  (`DATABASE_SLAVE_URL` → `DATABASE_READ_URL` → write URL fallback)
- `messaging.config.ts` — RabbitMQ URL + exchange + `registerHandlers`, Kafka
  brokers/clientId/groupId, SQS url/region/credentials
- `cache.config.ts` — driver (`redis` | `memcache`) + connection settings
- `storage.config.ts` — S3 endpoint/bucket/region/pathStyle/presigned TTL
- `security.config.ts` — throttler (`THROTTLE_TTL_MS`/`THROTTLE_LIMIT`), encryption key,
  tenant/organization header names, tenancy mode (`TENANCY_MODE` single|multi)
- `outbox.config.ts` — poll interval, batch size, max attempts, retry backoff,
  claim lease (`OUTBOX_CLAIM_LEASE_MS`), cleanup age (platform/outbox only)
- `idempotency.config.ts` — replay/TTL window (`IDEMPOTENCY_TTL_MS`, platform/idempotency only)
- `notification.config.ts` — SNS (topic ARN/region) + SES (from address/region)
- `observability.config.ts` — Sentry DSN/traces sample rate, Loki URL
- `scheduler.config.ts` — poll interval, batch size, lock TTL, reconciliation interval,
  worker concurrency, job attempts, retry escalation (`maxRetries` + backoff;
  platform/scheduler only)
- `batch-operation.config.ts` — max records per job, sync threshold, chunk size, worker
  concurrency, chunk attempts, reconciliation window, result-snapshot cap
- `import.config.ts` — file/row limits, chunk sizes, lock TTL, retention, preview, build SHA

`ConfigService` (`config/config.service.ts`) is a **typed facade** over Nest's
`ConfigService`: adapters use `getPostgres()`, `getRabbitMQ()`, `getOutbox()`, ... and never
touch `process.env` or raw string keys.

`env.util.ts` provides: `envFileCandidates()` (resolution order `.env.{NODE_ENV}.local` →
`.env.{NODE_ENV}` → `.env`), `ensureEnvLoaded()` (safe one-time env load for module-definition
time driver branching), `numericEnv`/`booleanEnv`/`stringEnv` parsers, and
`requiredInProduction()` fail-fast validation.

### shared-kernel/

Technical, non-business NestJS concerns:

```text
filters/       HttpExceptionsFilter (@Catch: validation/HTTP/statusCode-tagged errors →
               the standard error envelope)
interceptors/  RequestIdInterceptor   — requestId + x-correlation-id propagation, seeds the
                                         immutable CLS RequestContext (tenant/org/user/roles/
                                         locale/ip/userAgent)
               ResponseInterceptor   — success envelope { status, statusCode, data, message }
                                         (passes through StreamableFile/non-JSON and nestlens)
               LoggingInterceptor    — structured JSON request logging (ids, path, status,
                                         duration; never bodies)
               DeviceResponseInterceptor — reads x-device-type into CLS and maps `data`
                                         through the DTO class chosen by @DeviceResponse
pipes/         AppValidationPipe (extends nestjs-zod ZodValidationPipe; global APP_PIPE)
exceptions/    DomainException (framework-free base), InfrastructureException
decorators/    @DeviceContext param decorator, @DeviceResponse(mobile, web) metadata
               decorator, @KafkaEvent(topic) method decorator (consumed by KafkaConsumerHost)
types/         ApiResponse<T> ({ data, message }), DeviceType enum + IDeviceContext,
               pagination primitives (PageQuery, PageResult, normalizePageQuery,
               buildPageResult — default 20, max 100 per page)
```

### bootstrap/

`bootstrap/index.ts` composes independent steps, called from `main.ts`:

1. `configureSentry()` — `Sentry.init` before Nest bootstraps (no-op without `SENTRY_DSN`).
2. `NestFactory.create<FastifyApplication>` — Fastify adapter, 5 MB body limit, 30 s request/
   connection timeouts, 65 s keep-alive, leveled Nest logger.
3. `configureSecurity()` — `@fastify/helmet` (CSP directives in production) + `@fastify/compress`
   (gzip/deflate/br).
4. `configureCors()` — origins from config; empty origins are a fatal error in production.
5. `configureHttp()` — global prefix `api` + URI versioning (default `v1` → `/api/v1`).
6. `configureShutdown()` — shutdown hooks + `Sentry.close` on Fastify `onClose`.
7. `configureSwagger()` — `/api/docs` (disabled in production).
8. `configureServer()` — listen on `APP_HOST:PORT`.

### infrastructure/

**Third-party client initialization only** — no ports, no adapters, no business logic.
Deliberately **not** `@Global` so raw clients stay invisible to business modules (the single
exception is CLS, which the library requires to be global). See [§10](#10-infrastructure-layer).

### platform/

Services built on the infrastructure clients, exposed to business code as **ports**. The
`PlatformModule` imports every platform sub-module and re-exports them — and it is
**deliberately not `@Global`**: each business module lists `imports: [PlatformModule]` so the
dependency stays visible in module metadata. See [§9](#9-platform-layer).

### business/

`shared-business/` holds framework-independent primitives (see [§7](#7-domains--aggregates)).
Concrete aggregates live under bounded-context folders (`party`, `procurement`,
`sales`). Each context folder has a thin composing module (`PartyModule`,
`ProcurementModule`, `SalesModule`), aggregated by `BusinessModule`. `BusinessModule` and
everything below it may never import `@infrastructure`.

---

## 3. Business Module Anatomy

Every aggregate module follows the same shape (shown for `procurement/product`):

```text
business/<context>/<module>/
├── domain/
│   ├── aggregates/          # aggregate root + <name>.invariants.ts (registry registrations)
│   ├── entities/            # child entities (e.g. PurchaseOrderLine) + their invariants
│   ├── value-objects/       # typed VOs (id, sku, name, ...) + per-VO invariants files
│   ├── events/              # domain events (persisted to the outbox; payload only — no rehydrators)
│   ├── policies/            # policy definitions registered in policyRegistry
│   ├── factories/           # aggregate factory — the only sanctioned build path
│   ├── repositories/        # COMMAND repository port (abstract class = DI token)
│   └── types/               # enums + props/request/query-record type aliases
├── application/
│   ├── usecases/            # one class per command/query operation
│   ├── queries/             # QUERY repository port (abstract class = DI token)
│   ├── facades/             # implementations of this module's public/ ports (call own use cases)
│   ├── outbound-ports/      # ports this module CONSUMES (cross-module + company config)
│   └── integrations/
│       ├── publishes/       # <name>.integration-port.ts (send-to-outbox abstraction) +
│       │                    # per-event wire shapes (<name>.<event>.integration-event.ts)
│       └── listeners/       # broker/in-process listeners: *.event-emitter, *.rabbitmq,
│                            # *.kafka, *.sqs listener-event files
├── infrastructure/
│   ├── persistence/         # Prisma command/query repositories + domain↔row mapper
│   └── adapters/
│       ├── platform/        # adapters implementing this module's platform-facing ports
│       │                    # (outbox.adapter.ts, company-config.adapter.ts)
│       └── module/          # adapters implementing OTHER modules' outbound ports by
│                            # delegating to the owner's public/ port (consumer side)
├── presentation/
│   └── http/
│       ├── <name>.controller.ts     # thin controllers calling use cases directly
│       ├── requests/                # Zod request DTOs (createZodDto)
│       └── responses/               # Id response + per-endpoint web/mobile Zod response DTOs
├── public/
│   ├── contracts/           # plain reference shapes (ProductReference, ...)
│   ├── ports/               # abstract-class port this module EXPORTS to consumers
│   └── index.ts             # the only folder other modules may import
└── <module>.module.ts       # NestJS composition root for this aggregate
```

Anatomy of a use case:

- **Command use cases** are `@Injectable()` classes with an `execute(input)` method annotated
  `@Transactional()` (`@nestjs-cls/transactional`). They orchestrate module-local ports
  (company config), make cross-module calls through outbound ports, build/call the aggregate
  via its factory, persist through the **command repository port**, drain `pullEvents()` and
  append them to the **integration port** (which writes the outbox in the same transaction).
- **Query use cases** are read-only. They skip the aggregate and the outbox entirely and go
  through the **query repository port** bound to a Prisma implementation using
  `PrismaReadPort` (replica connection).
- Controllers call use cases **directly** — there is no inbound-port / mediator layer.

---

## 4. Dependency Direction & ESLint Enforcement

```mermaid
flowchart TD
    HTTP[HTTP Controller] --> UC[Use Case]
    UC --> DOM[Domain Aggregate + Factory]
    UC --> OUTBOUND[Outbound Ports<br/>company-config, cross-module]
    UC --> IP[Integration Port<br/>ProductIntegrationPort, ...]
    IP --> OA[OutboxAdapter] --> OWP[OutboxWriterPort platform]
    UC --> CMDREPO[Command Repository Port] --> PRISMACMD[Prisma command repo<br/>TransactionHost]
    QUC[Query Use Case] --> QREPO[Query Port] --> PRISMAQRY[Prisma query repo<br/>PrismaReadPort]
    OUTBOUND --> OA2[Consumer adapter] --> FACADE[Producer module facade] --> QUC
    PRISMACMD --> DB[(PostgreSQL)]
    PRISMAQRY --> DB
    OWP --> DB
    SCHED[OutboxScheduler cron] --> PUB[PublishPendingBatch]
    PUB --> MQ[MessageQueuePort<br/>broker by envelope]
    MQ --> BRK[RabbitMQ / Kafka / SQS]
    PUB --> BUS[InProcessEventBus.emit<br/>canonical envelope]
    DOM -. raises .-> EV[Domain Events]
```

Rules (enforced in `eslint.config.mjs`):

```text
Allowed:
  infrastructure   third-party clients + config + shared-kernel exceptions only
  platform         infrastructure clients ONLY (exposed as ports) — zero @business/**
                   imports; see the OutboxEvent contract below
  business module  its own internals, @platform ports, shared-business, shared-kernel types,
                   ANOTHER module's public/** or application/outbound-ports/** contract
Forbidden:
  domain        → @nestjs/common, @nestjs/core, @nestjs/config, @nestjs/event-emitter
  business      → @infrastructure/**  (always; listeners included)
  business      → internals of another module: domain/**, application/queries/**,
                  application/usecases/**, application/integrations/**,
                  application/facades/**, infrastructure/**
  shared-business → @platform/**, @infrastructure/**, any concrete module (@business/*/*/**)
  platform → @business/** (ANY, including shared-business) — a single ESLint
          regex bans it. Platform defines its OWN event contract in
          `@platform/outbox/outbox.types.ts` (`OutboxEvent` structural
          interface + `OutboxEventBase` + the canonical `OutboxEnvelope`). A
          business `DomainEvent` satisfies `OutboxEvent` STRUCTURALLY (same
          envelope fields), so the outbox pipes it with no shared type and no
          rehydration step — the payload is persisted and delivered verbatim
  raw client libs (Prisma, @prisma/adapter-pg, amqplib, kafkajs, ioredis/redis)
  → infrastructure/config/bootstrap only. The platform layer may ALSO use
  @golevelup/nestjs-rabbitmq and @ssut/nestjs-sqs (the adapters it wraps) and
  @nestjs/schedule (the platform owns cron); business listeners may import the
  broker packages ONLY to obtain the subscribe decorators.
  the BARE `@prisma/client` specifier → nowhere: import the generated client by
  relative path ('../../../generated/client'). The bare specifier resolves to
  the npm stub at runtime and breaks the compiled build.
  @nestjs/schedule → platform only (the outbox scheduler owns cron)
```

Carve-out: `application/integrations/listeners/**` may use the subscribe decorators
(`@RabbitSubscribe`, `@KafkaEvent`, `@SqsMessageHandler`, `@OnEvent`) but not the raw client
libraries, and handlers must delegate to use cases — never run business logic inline.

Run enforcement locally:

```bash
npm run lint          # eslint with --fix (includes architecture rules)
npm run lint:check    # eslint, no fixes
```

---

## 5. Ports & Adapters (Command / Query / Integration)

Every port is an **abstract class used as its own DI token**; use cases inject the abstract
class and the module binds the concrete adapter with `useClass`/`useExisting`.

Per aggregate module there are four port families:

| Port (token)                       | Defined in                            | Implemented by                                                                               | Used for                                                           |
| ---------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `ProductCommandRepository`         | `domain/repositories/`                | `PrismaProductCommandRepository` (via `TransactionHost`)                                     | reads/writes of the aggregate inside the `@Transactional` boundary |
| `ProductQuery`                     | `application/queries/`                | `PrismaProductQueryRepository` (via `PrismaReadPort`)                                        | read-model queries (list/get/purchasable)                          |
| `ProductIntegrationPort`           | `application/integrations/publishes/` | `infrastructure/adapters/platform/OutboxAdapter` (wraps platform `OutboxWriterPort`)         | append raised domain events to the outbox                          |
| `CompanyConfigPort` (module-local) | `application/outbound-ports/`         | `infrastructure/adapters/platform/CompanyConfigAdapter` (wraps platform `CompanyConfigPort`) | default currency / auto-approve threshold                          |

Example binding (`product.module.ts`):

```ts
@Module({
  imports: [PlatformModule],
  providers: [
    { provide: ProductCommandRepository, useClass: PrismaProductCommandRepository },
    { provide: ProductQuery, useClass: PrismaProductQueryRepository },
    { provide: ProductIntegrationPort, useClass: OutboxAdapter },
    { provide: CompanyConfigPort, useClass: CompanyConfigAdapter },
  ],
})
export class ProductModule {}
```

Cross-cutting **platform ports** business code injects (never the concrete services):
`OutboxWriterPort`, `RequestContextPort`, `CompanyConfigPort`
(platform), `NumberingPort`, `AuditPort`, `NotificationDispatchPort`, `CachePort`,
`FileStoragePort`, `LoggerPort`/`MetricsPort`/`ErrorTrackingPort`, `InProcessEventBus`,
`MessageQueuePort`, `PrismaReadPort`.

> Note: the platform `NumberingPort` (`PrismaNumberingService`, `number_sequences` table,
> race-safe upsert increment) is available for document numbering, but PurchaseOrder/GRN
> currently generate their numbers through their own command-repository sequence helpers —
> prefer `NumberingPort` for new documents.

This is what makes use cases unit-testable with fakes (see [§14](#14-testing-strategy)).

---

## 6. Cross-Module Communication

Modules exchange **queries through contracts**, in three layers:

1. **Public port (producer-owned)** — `business/<context>/<module>/public/`:
   a plain `*Reference` contract + an abstract-class port, re-exported from `public/index.ts`.
   The producer implements it with a **facade** in `application/facades/` that delegates to
   one of its own query use cases, and **exports the port**.
2. **Outbound port (consumer-owned)** — the consuming module declares the port it needs in
   `application/outbound-ports/` (typed against the producer's contract shape) and binds an
   adapter in `infrastructure/adapters/module/` that injects the producer's public port.
3. **Direct injection** — command use cases inject the outbound port token in their
   constructor; Nest resolves the bound adapter at instantiation time (the consuming
   module `imports` the producer module so the public port is resolvable):

```ts
constructor(private readonly vendorQueryPort: OrderableVendorPort) {}
```

Current wiring:

```text
PurchaseOrder ──PurchasableProductPort──▶ ProductModule: ProductForPurchaseFacade
              ──OrderableVendorPort────▶ VendorModule:   VendorForPurchaseFacade
                                           (bound in PurchaseOrderModule via its own
                                            OrderableVendorAdapter — outbound ports are
                                            consumer-owned; the producer never binds them)
GoodReceiptNote ──PurchaseOrderPort──▶ PurchaseOrderModule: PurchaseOrderForGrnFacade

PurchaseOrderModule exposes  PurchaseOrderForGrnPort   (public/)   → consumed by GRN adapter
GoodReceiptNoteModule exposes GrnForPurchaseOrderPort  (public/)   → reserved for PurchaseOrder
```

Nest `imports` are used **only to make exported providers resolvable** (e.g.
`PurchaseOrderModule imports ProductModule, VendorModule`) — no module ever reaches into
another module's `domain`/`usecases`/`infrastructure`.

```mermaid
sequenceDiagram
    participant PO as CreatePurchaseOrderUseCase
    participant OA as OrderableVendorAdapter (PO infra)
    participant VA as OrderableVendorPort binding
    participant UC as GetOrderableVendorUseCase
    participant QR as PrismaVendorQueryRepository
    PO->>OA: getOrderableVendor(id)
    OA->>UC: execute(id)
    UC->>QR: findOrderableById (PrismaReadPort)
    QR-->>PO: VendorReference | null
```

Business rules encoded in these query paths: only **ACTIVE** products are purchasable
(`findPurchasableById`) and only **ACTIVE** vendors are orderable (`findOrderableById`) —
a non-orderable vendor makes PO creation fail with `ConflictException`.

---

## 7. Domains / Aggregates

### shared-business primitives (framework-free)

```text
domain/bases/       AggregateRoot<ID> (version + addEvent/pullEvents drain snapshot),
                    Entity<ID>, ValueObject<T> (equals by props), DomainEvent
                    (eventId/occurredAt/version + correlationId/causationId/headers),
                    DomainFactory<TAggregate, TInput, TProps>
domain/common/value-objects/  Money (minor-units integer math, currency guards,
                    fromDecimal/toDecimal), VendorId
domain/registries/  invariantRegistry  — keyed Invariant list, enforce() throws on violation
                    policyRegistry     — keyed Policy list, evaluate()/enforce()
```

Aggregates register invariants/policies by importing side-effect files
(`*.invariants.ts`, `policies/*.ts`, `events/<name>.registry.ts`); rule classes never
cross-import aggregates.

### Product (procurement) — `domain/aggregates/product.aggregate.ts`

- VOs: `ProductId`, `Sku` (normalized uppercase), `ProductName`; `Money` unit price.
- Status: `ACTIVE | INACTIVE | DISCONTINUED`.
- Behavior: factory `create`, `update`, `changePrice`, `activate`, `deactivate`,
  `discontinue`, `isPurchasable()`.
- Invariants: non-negative price (`product.create`), legal transitions (`product.status-transition`
  — `DISCONTINUED` has no outgoing transitions).
- Policy: `product.reactivation` — a discontinued product can never be reactivated.
- Events: `ProductCreated/Updated/Activated/Deactivated/Discontinued` (persisted to the outbox).

### Vendor (party) — `domain/aggregates/vendor.aggregate.ts`

- VOs: `VendorCode` (uppercase), `VendorName`, `VendorEmail` (lowercase), phone/address props.
- Status: `ACTIVE | INACTIVE | BLOCKED`.
- Behavior: factory `create`, `update`, `activate`, `deactivate`, `block`.
- Policy: `vendor.orderability` — blocked/inactive vendors are never returned by
  `findOrderableById`, so they cannot receive purchase orders.
- Events: `VendorCreated/Updated/Activated/Deactivated/Blocked`.

### PurchaseOrder (procurement) — `domain/aggregates/purchase-order.aggregate.ts`

- Owns `PurchaseOrderLine[]` children (same product on a line merges quantities); references
  products/vendors **by id only**.
- Status machine:

```text
DRAFT ── submit ─▶ SUBMITTED ── approve ─▶ APPROVED ── issue ─▶ ISSUED ── close ─▶ COMPLETED
                     │             │                                              │
                     ├─ reject ──▶ REJECTED                                       │
                     └──────── cancel ─────▶ CANCELLED (from DRAFT/SUBMITTED/APPROVED)
```

- Behavior: `addLine`, `removeLine`, `setLine`, `submit`, `approve`, `reject(reason)`, `cancel`,
  `issue`, `close` (status → `COMPLETED`, event `PurchaseOrderCompleted`; `complete()` is a
  legacy alias), `requiresManualApproval(threshold)`, computed `subtotal`/`total` (`Money`).
- Invariants: editable only in `DRAFT`, ≥1 line before submit, positive quantity, legal
  transitions.
- Policy: `purchase-order.approval` — submitted orders with `total > autoApproveThreshold`
  (company config) require manual approval; the approve transition is a no-op for them.
- Order number: `PO-00000001` style, allocated through the command repository's
  `nextOrderSequence()`.
- Events: `PurchaseOrderCreated/Submitted/Approved/Rejected/Cancelled/Completed` +
  `LineAdded/LineRemoved`.

### GoodReceiptNote (procurement) — `domain/aggregates/grn.aggregate.ts`

- Owns `GrnLine[]` (productId, orderedQuantity, receivedQuantity, unitPrice; re-receiving the
  same product accumulates received quantity). References PO/vendors by id only.
- Status: `DRAFT | RECEIVED | COMPLETED | CANCELLED`.
- Behavior: `addLine`, `receive` (needs ≥1 line, stamps `receivedAt`), `complete`, `cancel`;
  editable only in `DRAFT`.
- Number: `GRN-<timestamp>` via the factory (a `nextGrnSequence()` helper exists on the
  command repository — switch to `NumberingPort` when hardening).
- Events: `GrnCreated/LineAdded/Received/Completed/Cancelled`.

---

## 8. Outbox, Events & Messaging

### 8.1 The transactional outbox

Every state-changing use case runs inside `@Transactional()` and appends each raised domain
event to the outbox **in the same DB transaction** as the aggregate change:
`use case → <Aggregate>IntegrationPort → OutboxAdapter → OutboxWriterPort (platform)`.

```mermaid
flowchart LR
    UC[Command Use Case @Transactional] --> UOW[(PostgreSQL tx)]
    UOW --> AGG[Aggregate state change]
    UOW --> OUT[INSERT outbox_messages]
    UOW -->|COMMIT| DB[(PostgreSQL)]
    OUT --> SCHED[OutboxScheduler cron 10s]
    SCHED --> PUB[PublishPendingBatch claimBatch]
    PUB --> MQ[MessageQueuePort<br/>broker by envelope param]
    MQ --> RMQ[RabbitMQ]
    MQ --> KAFKA[Kafka]
    MQ --> SQS[SQS]
    PUB --> BUS[InProcessEventBus.emit<br/>canonical envelope verbatim]
```

Flow details:

- `OutboxWriterPort.append(event, aggregateType, aggregateId, opts?)` — the single outbox
  port — builds the canonical envelope (`eventType` = domain event class name, JSON payload
  minus envelope fields, headers with `event-id`/`correlation-id`/`causation-id`/`tenant-id`/
  `broker` from `RequestContextPort`, `opts.broker` defaulting to `rabbitmq`) and saves it via
  the concrete `PrismaOutboxRepository` on the caller's `TransactionHost`.
- `PublishPendingBatchUseCase.execute()` (guarded against overlap, driven by `OutboxScheduler`)
  runs `claimBatch(batchSize, maxAttempts, claimLeaseMs)`: a single `UPDATE … WHERE id IN
  (SELECT … FOR UPDATE SKIP LOCKED)` over due `PENDING` rows (`nextRetryAt <= now`, claim older
  than the lease) stamps `claimToken` + `claimedAt` and increments `attempts` **without
  changing status**. Each record is then published to `MessageQueuePort` (broker by
  `envelope.broker`), emitted on `InProcessEventBus` under a restored tenant CLS context, and
  CAS-settled. Delivery order is claim order (`createdAt` asc).
- `OutboxScheduler`: dispatch tick on `OUTBOX_POLL_INTERVAL_MS`; hourly `cleanup()` deletes
  `PUBLISHED` rows older than `cleanupOlderThanHours`. Retry cadence is data-driven
  (`nextRetryAt` + `attempts`), not cron-driven. **No reconciler** — a crashed owner's lease
  expires and the next tick reclaims the row through the same clause.
- `OutboxMessageStatus`: `PENDING | PUBLISHED | DEAD_LETTER`. A publish error keeps the row
  `PENDING` with exponential backoff; once `attempts` exceeds `OUTBOX_MAX_ATTEMPTS` it parks
  `DEAD_LETTER` (terminal, alertable). Delivery is at-least-once; consumers dedupe on the
  stable `event-id`.
- In-process (`@OnEvent`) delivery is best-effort: a listener exception is logged, never
  reflected onto the row (the broker already holds the message).
- Publishing is **never** inside the business transaction. Business code only writes; the
  scheduler owns delivery. An unconfigured broker target throws (so the row retries), so Kafka
  without `KAFKA_BROKERS` / SQS without `SQS_URL` park rather than silently drop.

### 8.2 Domain events vs integration events

|            | Domain event                                          | Integration event                                              |
| ---------- | ----------------------------------------------------- | -------------------------------------------------------------- |
| Scope      | In-process, same monolith                             | Across brokers/processes                                       |
| Transport  | `InProcessEventBus` (EventEmitter2 adapter, wildcard) | RabbitMQ / Kafka / SQS                                         |
| Durability | Best effort                                           | Transactional outbox (guaranteed at-least-once)                |
| Persisted  | No                                                    | `outbox_messages`                                              |
| Example    | `ProductCreated` → `@OnEvent` listener                | Same event published as the canonical `OutboxEnvelope` |

Each module's `integrations/publishes/*.integration-event.ts` files declare the typed wire
shape per event (`eventType: 'product.created'`, etc.) as a publish contract; the outbox
itself serializes the domain event payload under the event class name.

### 8.3 Broker selection

There is **one** messaging port: `MessageQueuePort.publish(envelope)`. The `broker` field on
the canonical envelope picks the transport (default `rabbitmq`); `opts.broker` on
`OutboxWriterPort.append` sets it at write time. There is no routing table — a new consumer
transport means a new listener, and an unconfigured broker target throws so the outbox retries.

All transports carry the **same envelope** (`eventId`, `eventType`, `aggregateType`,
`aggregateId`, `payload`, `headers`, `occurredAt`): RabbitMQ publishes the envelope to the
topic exchange `erp.events` with the event type as routing key, Kafka uses the event type as
topic, SQS goes to the configured queue.

### 8.4 Listeners

Listeners live in `business/<context>/<module>/application/integrations/listeners/` — one
class per transport per module:

- `*.rabbitmq.listener-event.ts` — `@RabbitSubscribe` (durable queue, e.g.
  `product-created.erp`, routing key = event type).
- `*.kafka.listener-event.ts` — custom `@KafkaEvent('<EventType>')` decorator; the
  infrastructure `KafkaConsumerHost` discovers decorated methods via `DiscoveryService` at
  bootstrap and wires one shared consumer per topic.
- `*.sqs.listener-event.ts` — `@SqsMessageHandler('consumer1')` (`@ssut/nestjs-sqs`).
- `*.event-emitter.listener-event.ts` — `@OnEvent('<EventType>')` for in-process reactions;
  the handler receives the canonical envelope (`message.payload` is the business payload),
  fed by the outbox's `InProcessEventBus.emit`.

Handlers currently log (they are template examples); real reactions must delegate to use
cases/facades. Consumers are the only business code allowed to touch broker decorators.

---

## 9. Platform Layer

Each sub-system owns its folder, module and ports, **and a `README.md`** (purpose,
public API, layout, who-calls/how, data & config, tenancy behaviour, rules).
`PlatformModule` composes and re-exports them (not global — business modules import it
explicitly). `src/platform/README.md` is the service index and the canonical-anatomy /
add-a-service checklist that every module below follows; the build-it recipe with code
templates is `docs/PLATFORM-SERVICE-GUIDE.md`:

```text
platform/
├── outbox/          OutboxModule — OutboxWriterPort, PublishPendingBatchUseCase,
│                    OutboxScheduler, concrete PrismaOutboxRepository; SKIP-LOCKED claim with
│                    a claimedAt lease, nextRetryAt backoff, DEAD_LETTER, hourly cleanup and
│                    tenant stamping on every row
├── events/          EventsModule — NestEventBusAdapter (InProcessEventBus): a thin emit
│                    wrapper over EventEmitter2, no routing table, no rehydration
├── messaging/       MessagingModule — MessageQueuePort (+ MessageQueueService), routing on
│                    envelope.broker across RabbitMq/Kafka/Sqs publisher adapters
├── inbox/           InboxModule — InboxPort (receive→complete/fail): consumer-side dedupe,
│                    insert-as-claim on (tenant, company, consumer, messageId) + per-minute
│                    reconciler that parks exhausted messages in SUSPENDED
├── context/         ContextModule — ClsRequestContextService (RequestContextPort: per-request
│                    identity/trace, set/get/require + run() for background context),
│                    PrismaReadPort (bound to the infra PrismaReadService); TenancyAuthGuard
│                    (registered as APP_GUARD in app.module) enforces the single/multi trust
│                    boundary; the immutable RequestContext snapshot lives in ports/
├── locking/         LockingModule — RedisDistributedLockAdapter (DistributedLockPort):
│                    owner-token SETNX lease, Lua renew/release, fail-closed. Shared by the
│                    pipeline stages of scheduler/import (formerly scheduler-private)
├── idempotency/     IdempotencyModule — PrismaIdempotencyRepository (IdempotencyPort:
│                    insert-as-claim reserve → markCompleted/markFailed, response replay) +
│                    @Idempotent() decorator/interceptor + hourly purge of expired keys
├── cache/           CacheModule — Redis or Memcached CachePort adapter, chosen by the same
│                    resolveCacheDriver() the infrastructure layer uses (exactly one client)
├── configuration/   ConfigurationModule — PrismaCompanyConfigRepository (CompanyConfigPort),
│                    company resolved from the authenticated org, DEFAULT_COMPANY_ID fallback
├── audit/           AuditModule — PrismaAuditRepository (AuditPort): transactional audit rows
│                    enriched + redacted from CLS; wired into platform state transitions
├── numbering/       NumberingModule — PrismaNumberingRepository (NumberingPort): race-safe
│                    upsert-increment, tenant/company-namespaced keys, prefix/padding
├── notification/    NotificationModule — NotificationDispatchService
│                    (NotificationDispatchPort) → SES email / SNS push-sms adapters
├── observability/   ObservabilityModule — ConsoleLoggerAdapter (LoggerPort),
│                    PrometheusMetricsAdapter (MetricsPort, GET /api/v1/metrics),
│                    SentryErrorTrackingAdapter (ErrorTrackingPort, self-disabling)
├── storage/         StorageModule — S3FileStorageAdapter (FileStoragePort:
│                    upload/download/delete/metadata/presigned URL; no public-URL fallback)
├── condition-engine/ ConditionEngineModule — ConditionEvaluationService (ConditionEvaluator)
│                    + FieldResolverRegistry; generic AND/OR rule gate; data-owning modules
│                    register FieldResolvers (opt-in, never imported here)
├── scheduler/       SchedulerModule — DB-backed ScheduledJob table polled by SchedulerTicker,
│                    BullMQ async execution, retry→SUSPENDED/DEAD_LETTER escalation, per-jobType
│                    fire handlers via ScheduledJobHandlerRegistry, RabbitMqSchedulerEventPublisher;
│                    SchedulerPort facade + ops ports; HTTP /scheduled-jobs (lock via @platform/locking)
├── recurring/       RecurringModule — RecurringTemplate/Execution (TIME+EVENT trigger model),
│                    transactional claim+append+reschedule handler, stale-execution sweeper,
│                    DomainEventDispatcher; HTTP /recurring-templates
├── batch-operation/ BatchOperationModule — Sync/Async bulk transitions, job+row tables,
│                    BatchOperationHandlerRegistry, BullMQ chunk fan-out, claim-token fencing,
│                    reconcile (reset/recount/finalise/resume); HTTP /batch-operations (@Idempotent submit)
├── import/          ImportModule — upload→parse→mapping→validation→execution over S3,
│                    BullMQ fan-out, ImportHandlerRegistry, stage locks + row claim tokens,
│                    resume-not-kill reconciliation, storage purge; HTTP /import (@Idempotent create)
├── saga/            SagaModule — SagaInboundPort (SagaRouter) + SagaActionRegistry: company-
│                    configurable DO/UNDO orchestration over a frozen plan, SKIP-LOCKED step
│                    claim + lease, DO/UNDO compensation, per-company fairness cap
├── webhook/         WebhookModule — outbound delivery to subscriber URLs (signature-verified,
│                    per-delivery rows, BullMQ retries, circuit breaker auto-pause) and inbound
│                    provider webhooks (idempotency-reserved); HTTP /webhooks
└── (end)
```

Business code injects the **port abstractions** and never imports concrete platform services
or infrastructure clients.

> **Port discipline (current convention).** An inbound port + thin adapter exists only where
> there is a real public boundary — a cross-module API (`SchedulerPort`, `RecurringExecutionPort`,
> `RecurringTemplatePort`, public module ports). Where the sole consumer is the service's own
> controller/worker (batch-operation job commands), the controller injects the **use case
> directly** — no one-implementation port+adapter pairs. The moment another module needs the same
> operation it is published behind a port (recurring template creation = `RecurringTemplatePort`;
> the internal controller keeps using the use case directly). The four opt-in registries
> (`BatchOperationHandler` / `ImportHandler` / `ScheduledJobFireHandler` / `FieldResolver`)
> share `KeyedRegistryBase` (`shared-kernel/utils`); for business-side handlers, registration
> lives in the **composition root** — the handler is pure port data and
> `src/bootstrap/configure-*.ts` plugs it into the platform registry (see 9.1 — the pattern
> the generated business modules emit; vendor's import opt-in has migrated to the bridge).
> (Domain events reach the in-process bus through the outbox: the canonical
> envelope is emitted verbatim — no rehydration map.)

### 9.1 Opt-in registration (business → platform, dependency points inward)

The scheduler, recurring, batch-operation and import services each own a **registry**
(`ScheduledJobHandlerRegistry`, `BatchOperationHandlerRegistry`, `ImportHandlerRegistry`,
plus `FieldResolverRegistry` in condition-engine). A platform service never imports a business
module — the registry classes are exported through each platform sub-module and re-exported by
`PlatformModule`. Duplicates throw at boot.

**Composition-root bridge (current standard for business opt-ins — batch-operation uses it):**
generated adapters must stay pure `BatchOperationHandler` data + routing — no
`OnApplicationBootstrap`, no registry imports, business knows only platform **ports**. The
bridge file `src/bootstrap/configure-batch-operations.ts` (the only layer allowed to know
both sides — the composition root is the only layer allowed to know both) keeps a
generated-row table mapping each batch-capable aggregate's module to its handler and, after
modules are instantiated but before the listener starts, calls:

```ts
// src/bootstrap/configure-batch-operations.ts
registry.register(app.select(ownerModule).get(batchHandler, { strict: true }));
```

```ts
// purchase-order/infrastructure/adapters/platform/purchase-order-batch-operation.adapter.ts — PURE handler
@Injectable()
export class PurchaseOrderBatchOperationAdapter implements BatchOperationHandler {
  aggregateType(): string { return 'PurchaseOrder'; }
  supportedOperations(): string[] { return ['submit', 'approve', 'reject', 'cancel']; }
  // validate()/execute() → own use cases (unchanged)
}

// procurement/purchase-order.module.ts — no class body, no registration, no lifecycle
@Module({ imports: [PlatformModule, …], providers: [PurchaseOrderBatchOperationAdapter, …] })
export class PurchaseOrderModule {}
```

The handler is its own registration metadata: `registry.register(handler)` reads key +
operations from it, so there is no second source to drift from. Adding a batch-capable
aggregate = one row in `BATCH_OPERATION_AGGREGATES` (what the module generator appends).

Legacy shape: recurring→scheduler (platform→platform) injects registry + handler in its
own module's `onApplicationBootstrap` — fine, platform may know platform. Business opt-ins
(batch-operation, import) are bridged from `src/bootstrap/configure-batch-operations.ts` and
`configure-imports.ts` respectively.

### 9.2 Canonical platform-service structure (mandatory for every NEW service)

> The full step-by-step recipe — exact file names, copy-pasteable port/repo/use-case/
> controller/DTO/event code shapes, the naming map, the invariant checklist and the
> verification battery — lives in **`docs/PLATFORM-SERVICE-GUIDE.md`**. This section is
> the summary; the guide is what you follow to build a service strictly.

The existing services converged on one shape; new platform services MUST start from it
(following `§15` symmetrically on the business side):

```text
platform/<service>/
├── README.md                     REQUIRED — sections: What it does · Public API ·
│                                 Layout · Who calls it / how called · Data & config ·
│                                 Tenancy behaviour · Rules & gotchas
├── <service>.module.ts           bindings + exports ONLY (no logic, not @Global)
├── ports/                        abstract classes = DI tokens (inbound + outbound)
├── usecases/                     one class per capability; @Transactional at their
│                                 boundary; controllers/workers inject use cases directly
│                                 UNLESS the operation crosses a module boundary (then
│                                 publish an inbound port + thin adapter — 9.1 rule)
├── repositories/ (+adapters/)    Prisma data access (TransactionHost) | queue/broker/cache I/O
├── http/requests/*.request.dto.ts  ONE DTO per file (business-module convention, incl.
│                                 platform services); controllers stay thin
├── <name>.ticker.ts / *reconciliation* / *sweeper*  crons converging crashed executions
└── __testing__/                  in-memory port fakes so use cases unit-test without DB
```

Non-negotiable invariants (all enforced or precedented in the current services):

1. **Tenancy**: every owned table gets `tenantId String?`; reads/mutations thread the
   request tenant and enforce `TenantScope` (foreign ⇒ 404); background executions
   restore context with `RequestContextPort.run(payload)` before touching services
   that read CLS (numbering, company config, audit).
2. **Idempotent by construction**: claims use insert-as-claim or `FOR UPDATE
   SKIP LOCKED`, terminal writes are CAS/token-fenced, and at-least-once redelivery
   can only ever re-run, never double-apply. Cross-replica "one-winner-now" uses
   `DistributedLockPort` (`platform/locking`, fail-closed); request/effect
   dedupe-with-replay uses `IdempotencyPort` / `@Idempotent()` (`platform/idempotency`).
3. **Side effects leave via the outbox only** (`OutboxWriterPort` inside the use-case
   transaction); in-process listeners get the same canonical envelope (payload verbatim).
4. **State escalation visible**: transient failures back off with bounded retries,
   terminal poison states park (`SUSPENDED`/`DEAD_LETTER`/`FAILED`) — nothing loops
   forever and nothing dies silently; stale in-flight states have a reconciler.
5. **Config**: `src/config/<service>.config.ts` (+ `ConfigService` getter with
   identical defaults) — no raw `process.env` outside `src/config`.
6. Registration of business handlers into platform registries happens in the
   **composition root** (`src/bootstrap/configure-<feature>.ts` table → `register(handler)`
   — §9.1 standard; the registry docstring says so too); `PlatformModule` imports+exports
   the new module; `src/platform/README.md` catalog row + this tree entry get updated in the
   same PR.

## 10. Infrastructure Layer

Pure client wiring — each sub-module initializes a third-party client and exposes it only to
the platform layer (and to CLS, globally by necessity):

```text
infrastructure/
├── database/prisma/   PrismaWriteService + PrismaReadService: PrismaClient subclasses on the
│                      PrismaPg driver adapter over pg.Pool. Read reuses the write pool when
│                      no replica URL is configured. Health check SELECT 1 on boot (fatal in
│                      production, warning elsewhere).
├── context/           ClsModule.forRoot (global + middleware) with ClsPluginTransactional →
│                      TransactionalAdapterPrisma keyed on PrismaWriteService. This powers
│                      @Transactional() and the TransactionHost injected by command repos.
├── cache/             CacheModule.forRoot() selected by CACHE_DRIVER: RedisService (ioredis,
│                      lazy-configured, retry strategy) or @andreafspeziale/nestjs-memcached.
│                      Exported as the shared INFRA_CACHE_MODULE singleton.
├── messaging/         EventEmitterModule (wildcard), @golevelup RabbitMQ module
│                      (topic exchange erp.events, persistent publishes, NACK on handler
│                      error), @ssut/nestjs-sqs (no-op when unconfigured), KafkaService
│                      (kafkajs producer, disabled without brokers) + KafkaConsumerHost
│                      (@KafkaEvent handler discovery/wiring).
├── notification/      SesService / SnsService AWS client wrappers (self-disabling when the
│                      from-address / topic is missing; default credential chain otherwise).
├── storage/           @amirrivand/nestjs-file-storage S3 disk config factory.
├── queue/             QueueModule — shared BullMQ wiring (available; not yet imported by
│                      InfrastructureModule — register it when introducing job queues).
└── infrastructure.module.ts  non-global root composing the client modules.
```

**Note:** aggregate persistence adapters (command/query repositories + mappers) do **not**
live here — they live inside each business module's `infrastructure/` folder so a module's
persistence stays encapsulated with it.

---

## 11. Persistence & Data Model

- **Prisma 7**, `prisma-client` generator (CJS module format) output to `src/generated/` —
  import through the `@prisma/client` alias (`src/generated/client.ts`). Generated code is
  ESLint-ignored. **At runtime the alias does not resolve**: import the generated client by
  its **relative path** (`'../../../generated/client'`). The bare `@prisma/client` specifier
  points at the npm stub, which expects a client at `.prisma/client/default` and throws
  `Cannot find module '.prisma/client/default'` in the compiled build.
- `prisma.config.ts` points at `prisma/schema` (folder); the datasource URL comes from
  `DATABASE_URL` via the config file (no `env()` in the schema). There is no
  `prisma/migrations` path — the schema folder is the whole contract.
- Schema is **split per aggregate** under `prisma/schema/<context>/<module>.prisma`:

| Model                                             | Table                                                   | Notes                                                                                  |
| ------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `Product`                                         | `products`                                              | unique `sku`, `status` enum, `unitPrice Decimal(18,2)`, `version`                      |
| `Vendor`                                          | `vendors`                                               | unique `code`, `status` enum, `version`                                                |
| `PurchaseOrder`                                   | `purchase_orders`                                       | unique `orderNumber`, vendor by uuid id, totals, `version`                             |
| `PurchaseOrderLine`                               | `purchase_order_lines`                                  | `@@unique([purchaseOrderId, productId])`, cascade delete                               |
| `GoodReceiptNote`                                 | `good_receipt_notes`                                    | unique `grnNumber`, purchaseOrderId + vendorId refs, `receivedAt`                      |
| `GrnLine`                                         | `grn_lines`                                             | ordered/received quantities, `@@unique([grnId, productId])`                            |
| `OutboxMessage`                                   | `outbox_messages`                                       | JSON payload/headers, status enum, `@@index([status, publishedAt])`                    |
| `CompanyConfig`                                   | `company_configs`                                       | unique `companyId`, default currency, auto-approve threshold                           |
| `NumberSequence`                                  | `number_sequences`                                      | unique `key`, BigInt `currentValue`, prefix/padding/step                               |
| `AuditLog`                                        | `audit_logs`                                            | action/entity/actor, tenant/org/request/correlation ids                                |
| `Invoice`                                         | `invoices`                                              | unique `invoiceNo`, `customerId`, `status` enum, `lines` JSON, `version` (sales demo)  |
| `ScheduledJob`                                    | `scheduled_jobs`                                        | jobType/scope/scheduleMode, `nextRunAt`, `status`, `version`, `lockedUntil/By`         |
| `ScheduledJobDispatchLog` / `ScheduledJobEditLog` | `scheduled_job_dispatch_log` / `scheduled_job_edit_log` | dispatch outcomes + cron/nextRun edits                                                 |
| `RecurringTemplate` / `RecurringExecution`        | `recurring_templates` / `recurring_executions`          | TIME+EVENT trigger model; execution unique on `(templateId, triggerKey)` = idempotency |
| `BatchOperationJob` / `BatchOperationJobRow`      | `batch_operation_jobs` / `batch_operation_job_rows`     | header counters + per-row claim/status/result_snapshot                                 |
| `StorageObject` / `ImportJob` / `ImportJobRow`    | `storage_objects` / `import_jobs` / `import_job_rows`   | upload + job (descriptor snapshot, statusHistory) + row outcomes                       |

All money columns are `Decimal(18,2)`; domain converts through `Money` (minor units).
**No migration folder.** The database is created straight from `prisma/schema`
(`prisma db push`, `npm run db:push`) — there is currently no
`prisma/migrations/` directory and no `db:migrate` / `db:deploy` script. The
schema files under `prisma/schema/<context>/` are the single source of truth
for the table contracts (each carries a header comment documenting them).

- **Command side** (`*CommandRepository` impls) injects `TransactionHost<TransactionalAdapterPrisma>`
  so every read-modify-save participates in the use case's `@Transactional()` boundary — and
  the outbox row commits in the same transaction. `version` is written back for optimistic
  concurrency.
- **Query side** (`*QueryRepository` impls) injects `PrismaReadPort` (the replica client) and
  returns plain records (`ProductQueryRecord`, ...) — never aggregates.
- Each module keeps a `prisma-<name>.mapper.ts` translating domain ↔ row (`toDomain`, `toRow`,
  `toRecord`).

---

## 12. HTTP, Validation, Error Handling

### Global pipeline (registered in `AppModule`)

```text
Request → RequestIdInterceptor → LoggingInterceptor → DeviceResponseInterceptor
       → AppValidationPipe (Zod) → Controller → Use Case → ...
       → HttpExceptionsFilter (errors) → ResponseInterceptor (success envelope)
```

- **RequestIdInterceptor** — generates `requestId`, propagates `x-correlation-id`, and seeds
  the immutable `RequestContext` snapshot in CLS from headers (`x-tenant-id`,
  `x-company-id`, `x-user-id`, `x-roles`, `accept-language`) — consumed by outbox,
  audit, logging and `RequestContextPort`.
- **DeviceResponseInterceptor** — reads `x-device-type` (`mobile` | default `web`) into CLS;
  when the handler is annotated `@DeviceResponse(MobileDto, WebDto)`, maps `data` through the
  matching Zod DTO (arrays mapped item-wise).
- **ResponseInterceptor** — success envelope `{ status: 'SUCCESS', statusCode, data, message }`;
  controllers return `{ data, message }` (the `ApiResponse<T>` type) or plain values (default
  message). Stream/files bypass wrapping.
- **AppValidationPipe** — global `nestjs-zod` pipe; request DTOs are
  `createZodDto(z.object({...}))` classes in `presentation/http/requests/`.

### Error mapping (`HttpExceptionsFilter`)

| Thrown                                                                                    | Response                                                                              |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `BadRequestException` with string[] messages (Zod validation)                             | `422 { status:'VALIDATE_ERROR', data: { field: msg } }`                               |
| Nest `HttpException` (`NotFoundException` 404, `ConflictException` 409, ...)              | `{ status:'ERROR', statusCode, message }`                                             |
| Plain `Error` carrying a numeric `statusCode` (invariant/policy/`Money` violations → 422) | `{ status:'ERROR', statusCode, message }`                                             |
| Anything else                                                                             | `500 { status:'SERVER_ERROR', message:'Internal server error' }` — details never leak |

Domain code throws **framework-free** errors (`DomainException`/`InfrastructureException`
classes exist in `shared-kernel/exceptions/`; registered invariants currently throw
`Error` + `statusCode: 422`, which the filter maps). Controllers stay thin: validate DTO →
call use case → wrap `{ data, message }` — they never read `RequestContextPort`; the use
case resolves tenant/actor from the injected port itself (explicit `tenantId`/actor inputs
stay as overrides for background executions that restored a different context).

### REST surface (all under `/api/v1`)

| Module           | Endpoints                                                                                                                                                                                                                                    |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| products         | `POST /products`, `GET /products` (paged), `GET /products/:id`, `PATCH /products/:id`, `PATCH /products/:id/change-price`, `PATCH /products/:id/{activate,deactivate,discontinue}`                                                           |
| vendors          | `POST /vendors`, `GET /vendors` (paged), `GET /vendors/:id`, `PATCH /vendors/:id`, `PATCH /vendors/:id/{activate,deactivate,block}`                                                                                                          |
| purchase-orders  | `POST /purchase-orders`, `GET /purchase-orders` (paged), `GET /purchase-orders/:id`, `POST /purchase-orders/:id/lines`, `DELETE /purchase-orders/:id/lines/:productId`, `PATCH /purchase-orders/:id/{submit,approve,reject,cancel,complete}` |
| grn              | `POST /grn`, `GET /grn` (paged), `GET /grn/:id`, `POST /grn/:id/lines`, `PATCH /grn/:id/{receive,complete}`                                                                                                                                  |
| invoices         | `POST /invoices`, `GET /invoices/:id`, `POST /invoices/:id/post` (sales demo)                                                                                                                                                                |
| scheduler        | `GET /scheduled-jobs` (+`/:id`, `/:id/dispatch-log`), `PATCH /scheduled-jobs/:id`, `POST /scheduled-jobs/:id/cancel`, `POST /scheduled-jobs/:id/dispatch-now` (force due-now), `GET /scheduler/health`                                                                                                |
| recurring        | `POST /recurring-templates`, `GET /recurring-templates` (+`/:id`), `POST /recurring-templates/:id/{pause,resume,cancel}`                                                                                                                     |
| batch-operations | `GET /batch-operations/_registry`, `POST /batch-operations/validate`, `POST /batch-operations` (Sync 200 / Async 202), `GET /batch-operations` (+`/:id`, `/:id/rows`), `POST /batch-operations/:id/cancel`                                   |
| import           | `GET /import/_registry`, `POST /import/uploads`, `POST /import/jobs`, `GET /import/jobs` (+`/:id`, `/:id/preview`, `/:id/report`), `PATCH /import/jobs/:id/mapping`, `POST /import/jobs/:id/{execute,cancel}`, `GET /import/:entityKey/init` |
| notifications    | `GET /notifications/_registry`, `POST /notifications`, `GET /notifications` (+`/:id`), `GET /notifications/preferences/:recipientRef`, `PUT /notifications/preferences`, `POST /notifications/webhooks/:channel`                                                       |
| webhooks         | `GET /webhooks/_registry`, `GET /webhooks/subscriptions` (+`/:id`), `POST /webhooks/subscriptions`, `PATCH /webhooks/subscriptions/:id`, `DELETE /webhooks/subscriptions/:id`, `GET /webhooks/subscriptions/:id/deliveries`, `POST /webhooks/deliveries/:id/redeliver`, `POST /webhooks/inbound/:source` |
| metrics          | `GET /metrics` (Prometheus scrape)                                                                                                                                            |

---

## 13. Observability & Security

### Observability

- `LoggerPort` (console adapter; swap for Loki/structured shipping behind the same port).
- `MetricsPort` (Prometheus `prom-client` registry with `erp_` default-metric prefix).
- `ErrorTrackingPort` (Sentry adapter, self-disabling without DSN; `Sentry.init` happens once
  in bootstrap so boot failures are captured too).
- Structured request logging + CLS request/correlation ids make every log, outbox row and
  audit entry traceable to a request.

### Security

- Helmet (with production CSP) + response compression at the Fastify level.
- Strict CORS from config; empty `CORS_ORIGINS` aborts production boot.
- **Rate limiting**: global `ThrottlerGuard` wired in `AppModule` from config
  (`THROTTLE_TTL_MS`/`THROTTLE_LIMIT`) with stricter per-route overrides
  (`@Throttle`) on expensive endpoints — batch submit (20/min), import uploads and
  job creation (30/min).
- JWT/auth packages (`auth.config.ts`, `@nestjs/jwt`); the global **`TenancyAuthGuard`**
  enforces the trust boundary per `TENANCY_MODE`: `single` (default) trusts the identity
  headers behind a verified gateway; `multi` requires a bearer JWT signed with
  `JWT_ACCESS_SECRET` carrying a `tenantId` claim — every other request is rejected and raw
  identity headers are ignored. Health/scrape routes opt out via `@SkipTenancy()`
  (Prometheus is exposed at `GET /api/v1/metrics`).
- Multi-tenancy: identity flows into CLS `RequestContext` and is stamped onto audit rows,
  outbox messages and numbering sequence keys (per-tenant/company number streams). Company
  configuration resolves from the authenticated organization (hard failure in multi mode if
  the company has no config row). Platform reads/mutations pass the request tenant into
  their use cases, which enforce visibility through `TenantScope` (shared-kernel): a
  foreign-tenant row surfaces as `NotFoundException` — no existence leak. Rows without a
  tenant are platform-owned; requests without a tenant header (single-tenant deployments)
  see everything. Background executions (BullMQ workers, outbox re-dispatch) restore the
  same tenant/correlation context before running business handlers.
- State-changing platform operations (schedule cancel/dispatch-now, batch cancel, import
  cancel/execute, recurring pause/resume/cancel) write `AuditPort` trail rows
  (actor/tenant auto-attributed from context, sensitive keys redacted).
- UUID identifiers everywhere; `version` columns exist on aggregates, and the scheduler's
  PATCH enforces it (`expectedVersion`). Enforcing aggregate-level optimistic concurrency
  in the business write repositories is open work tied to per-tenant business-table
  migration (business schema is not yet tenant-scoped — platform tables only).
- Secrets only via env (`requiredInProduction` fail-fast); 5 MB request body limit.
- API versioning via URI (`/api/v1`), Swagger disabled in production.

---

## 14. Testing Strategy

- **Unit tests** (`*.spec.ts`, colocated, Jest + `tsconfig.jest.json`): aggregate behavior,
  invariants, policies — e.g. `purchase-order.aggregate.spec.ts` covers line math, submit/
  approve/reject transitions, event raising and the approval threshold policy.
  Use cases can be tested with fakes for the repository/query/integration ports; the
  `@Transactional()` decorator runs as no-op via `test/utils/noop-transaction-host.ts`
  (`initNoopTransactionHost()`), so no Postgres, no brokers, no Nest runtime.

  ```bash
  npm test
  ```

- **E2E smoke** (`test/app.e2e-spec.ts`, `jest-e2e.json`): boots the full `AppModule` against
  `docker compose` services and asserts DI wiring (use cases + platform ports resolve) and
  the JSON error envelope on unknown routes via Fastify `inject`.

  ```bash
  docker compose up -d
  npm run test:e2e
  ```

- Coverage: `npm run test:cov`. `nestjs-doctor` is available for module-graph checks.

---

## 15. Creating a New Business Module

> Step-by-step file templates, binding style and the acceptance checklist:
> **`docs/BUSINESS-MODULE-GUIDE.md`** (reference implementation: `procurement/product`).

1. **Domain** — `domain/aggregates` (aggregate + `<name>.invariants.ts`),
   `domain/value-objects`, `domain/events` (domain events; persisted to the outbox),
   `domain/policies`, `domain/factories` (side-effect-import the
   invariants/policies files here), `domain/types`, `domain/repositories/<name>-command.repository.ts`
   (abstract class port).
2. **Application** — `application/usecases` (commands: `@Transactional()`,
   factory → save → drain events → integration port; queries via the query port),
   `application/queries/<name>.query.ts` (query port),
   `application/outbound-ports/` (module-local `CompanyConfigPort` + any cross-module ports),
   `application/integrations/publishes/<name>.integration-port.ts`.
3. **Public contract** — `public/contracts/<name>-reference.contract.ts`,
   `public/ports/...` + `public/index.ts`; implement with `application/facades/` delegating to
   your own query use cases; export the port from your module.
4. **Infrastructure** — `infrastructure/persistence/` (Prisma command repo on
   `TransactionHost`, query repo on `PrismaReadPort`, mapper),
   `infrastructure/adapters/platform/` (outbox + company-config + numbering adapters; and, for opted-in aggregates, the batch/import/recurring handler adapters).
5. **Presentation** — `presentation/http/` controller (thin) + Zod request DTOs +
   web/mobile response DTOs wired through `@DeviceResponse`.
6. **Module** — `<name>.module.ts`: `imports: [PlatformModule]`, bind every port to its
   adapter, register listeners, export your public port(s). Add the module to its context
   module (e.g. `ProcurementModule`). For a **bridged opt-in** (batch-capable, etc.) the
   pure handler adapter from step 4 also needs one row appended to the relevant
   `src/bootstrap/configure-<feature>.ts` table (e.g. `BATCH_OPERATION_AGGREGATES`) —
   without it the registry stays empty and the opt-in is silently inert (§9.1).
7. **Persistence schema** — `prisma/schema/<context>/<name>.prisma`, then
   `npm run db:migrate` (client regenerates to `src/generated/`).
8. **Listeners** — only if the module reacts to events; add `integrations/listeners/` classes
   and register new fan-out targets in `FAN_OUT_EVENTS` (routing policy) when a Kafka/SQS
   listener is added.
9. **Enforcement list** — add `<context>/<module>` to `businessModules` in
   `eslint.config.mjs`.
10. **Tests** — aggregate spec + use case fakes; `npm test`, then `npm run lint:check`.
11. **Docs** — platform services additionally REQUIRE a module `README.md` following the
    template in `src/platform/README.md` (What it does · Public API · Layout ·
    Who calls it / how called · Data & config · Tenancy behaviour · Rules & gotchas);
    new *platform* services follow the canonical anatomy of `§9.2` (checklist in
    `src/platform/README.md` — "Adding a new platform service"). A business module's
    contract lives in `public/index.ts` JSDoc; a README is optional there.

Symmetry rule: if your module needs data from another module, define an **outbound port** in
`application/outbound-ports/` typed against the producer's `public/` contract, bind a
consumer-side adapter in `infrastructure/adapters/module/`, and inject the port directly —
never import the other module's internals.

---

## 16. Commands

```bash
cp .env.example .env
docker compose up -d          # PostgreSQL, Redis, RabbitMQ, Kafka (KRaft single node)
npm install                   # also runs prisma generate (postinstall)
npm run db:push               # create/sync the database from prisma/schema
npm run db:seed               # sample products & vendors
npm run start:dev             # http://localhost:4000/api/v1, Swagger /api/docs
```

```bash
npm run lint:check            # lint + architecture checks (no fixes)
npm run lint                  # lint + auto-fix
npm test                      # unit tests
npm run test:e2e              # e2e smoke (requires docker compose up -d)
npm run build                 # compile to dist/
npm run start:prod            # build + run compiled app (tsconfig-paths for aliases)
npm run db:generate           # prisma generate
npm run db:deploy             # apply migrations (staging/production)
npm run prisma:studio         # Prisma Studio UI
```

Environment drivers: `CACHE_DRIVER` (redis/memcache), `KAFKA_BROKERS` (empty → Kafka off),
`SQS_URL` (empty → SQS off), `REDIS_URL`, `SENTRY_DSN`, `DATABASE_SLAVE_URL` (read replica),
`OUTBOX_*` tuning knobs — all optional with safe local defaults.
