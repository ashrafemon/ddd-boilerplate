# ERP Boilerplate — Architecture

A production-oriented **NestJS 11 + TypeScript (strict) + PostgreSQL (Prisma 7)** ERP backend built as
an **event-driven modular monolith**. The codebase applies **Domain-Driven Design (DDD)**,
**Hexagonal Architecture (Ports & Adapters)**, **Clean Architecture** and a lightweight
**CQRS-style split** between command and query paths.

## Key pillars

| Pillar | Description |
|--------|-------------|
| Strict layer separation | Domain knows nothing about NestJS, Prisma, or any broker |
| Ports & Adapters | Every external dependency (DB, brokers, cache, storage, email, metrics, company config, outbox) is behind a port (abstract class used as DI token), bound to an adapter in a composition-root module |
| Transactional outbox | Integration events are persisted atomically with the aggregate change and published by a scheduler; no events are lost and nothing publishes inside the business transaction |
| In-process event bus + integration event routing | Domain events drive local reactions; a routing policy decides which broker(s) receive each event |
| Module-to-module contracts | Aggregates talk to each other through `public/` port contracts implemented by facades, injected **directly** through the Nest container, never by importing another module's internals |
| Device-aware responses | One controller, two response shapes (`web` full payload, `mobile` minimal payload) selected by the `x-device-type` header and validated with Zod |
| Architecture enforced by ESLint | `no-restricted-imports` in `eslint.config.mjs` |

---

## 1. Top-Level Folder Map

```
src/
├── app.module.ts            # root composition root + global interceptors/filter/pipe
├── main.ts                  # entry point, calls bootstrap()
├── config/                  # .env-driven typed configuration blocks + ConfigService facade
├── shared-kernel/           # technical NestJS concerns: filters, interceptors, pipes,
│                            # decorators, exceptions, types (device context, pagination)
├── bootstrap/               # app bootstrap steps (sentry, security, cors, http, swagger, ...)
├── infrastructure/          # third-party client init ONLY (Prisma, brokers, cache, AWS, CLS)
├── platform/                # services built on those clients, exposed as ports
│                            # (outbox, events, messaging, context, cache, audit, numbering,
│                            #  configuration, notification, observability, storage,
│                            #  condition-engine, locking, idempotency, scheduler, recurring,
│                            #  batch-operation, import, saga, webhook, plus platform-organization
│                            #  and platform-ai)
├── generated/               # Prisma-generated client (DO NOT EDIT)
└── business/
    ├── shared-business/     # framework-independent domain primitives + registries
    ├── party/vendor/                    # Vendor aggregate       (context: party)
    ├── procurement/product/             # Product aggregate      (context: procurement)
    ├── procurement/purchase-order/      # PurchaseOrder aggregate (context: procurement)
    ├── procurement/good-receipt-note/   # GoodReceiptNote aggregate (context: procurement)
    └── sales/invoice/                   # Invoice aggregate       (context: sales)
```

Module aliases (see `tsconfig.json` + Jest `moduleNameMapper`):

| Alias | Path |
|-------|------|
| `@config/*` | `src/config/*` |
| `@shared-kernel/*` | `src/shared-kernel/*` |
| `@bootstrap/*` | `src/bootstrap/*` |
| `@infrastructure/*` | `src/infrastructure/*` |
| `@platform/*` | `src/platform/*` |
| `@business/*` | `src/business/*` |
| `@test/*` | `test/*` |
| `@prisma/client` | `src/generated/client.ts` |

---

## 2. Layers and Responsibilities

### `config/`

The **only** place that reads `process.env`. Each concern is a typed `registerAs` block loaded by
`ConfigModule` (which is `@Global`):

- `app.config.ts` — env, name, port/host, log level, CORS origins, app/API URLs, Swagger metadata
- `auth.config.ts` — JWT access/refresh secrets + TTLs, settings encryption key
- `database.config.ts` — driver + `postgres.url` / `postgres.readUrl`
- `messaging.config.ts` — RabbitMQ URL + exchange, Kafka brokers/clientId/groupId, SQS url/region/credentials
- `cache.config.ts` — driver (`redis` | `memcache`) + connection settings
- `storage.config.ts` — S3 endpoint/bucket/region/pathStyle/presigned TTL
- `security.config.ts` — throttler TTL/limit, encryption key, tenant/organization header names, tenancy mode
- `outbox.config.ts` — poll interval, batch size, max attempts, retry backoff, claim lease, cleanup age
- `idempotency.config.ts` — replay/TTL window
- `notification.config.ts` — SNS (topic ARN/region) + SES (from address/region)
- `observability.config.ts` — Sentry DSN/traces sample rate, Loki URL
- `scheduler.config.ts` — poll interval, batch size, lock TTL, reconciliation interval, worker concurrency
- `batch-operation.config.ts` — max records per job, sync threshold, chunk size, worker concurrency
- `import.config.ts` — file/row limits, chunk sizes, lock TTL, retention, preview, build SHA

`ConfigService` is a typed facade over Nest's `ConfigService`. Adapters use `getPostgres()`,
`getRabbitMQ()`, `getOutbox()`, ... and never touch `process.env` or raw string keys.

### `shared-kernel/`

Technical, non-business NestJS concerns:

| Folder | Contents |
|--------|----------|
| `filters/` | `HttpExceptionsFilter` — validation/HTTP/statusCode-tagged errors → standard error envelope |
| `interceptors/` | `RequestIdInterceptor`, `ResponseInterceptor`, `LoggingInterceptor`, `DeviceResponseInterceptor` |
| `pipes/` | `AppValidationPipe` (extends nestjs-zod `ZodValidationPipe`; global `APP_PIPE`) |
| `exceptions/` | `DomainException` (framework-free base), `InfrastructureException` |
| `decorators/` | `@DeviceContext`, `@DeviceResponse(mobile, web)`, `@KafkaEvent(topic)`, `@Rbac(resource, action)` |
| `middleware/` | `CompanyConfigContextMiddleware` — stamps company config into CLS RequestContext |
| `guards/` | `HttpThrottlerGuard`, `RbacGuard` |
| `pipes/` | `AppValidationPipe` |
| `types/` | `ApiResponse<T>`, `DeviceType` enum, `IDeviceContext`, pagination primitives |

### `bootstrap/`

`bootstrap/index.ts` composes independent steps, called from `main.ts`:

1. `configureSentry()` — `Sentry.init` before Nest bootstraps (no-op without `SENTRY_DSN`)
2. `NestFactory.create` — Fastify adapter, 5 MB body limit, 30 s request/connection timeouts, 65 s keep-alive
3. `configureSecurity()` — `@fastify/helmet` + `@fastify/compress`
4. `configureCors()` — origins from config; empty origins are fatal in production
5. `configureHttp()` — global prefix `api` + URI versioning (default `v1` → `/api/v1`)
6. `configureShutdown()` — shutdown hooks + `Sentry.close` on Fastify `onClose`
7. `configureSwagger()` — `/api/docs` (disabled in production)
8. `configureServer()` — listen on `APP_HOST:PORT`
9. **Composition-root bridges** — `configureBatchOperations`, `configureImports`,
   `configureNotifications`, `configureWebhooks` — bridge business opt-in registries
   to platform registries before `listen()`
10. **Middleware registration** — `CompanyConfigContextMiddleware` stamps company config
    into CLS `RequestContext` before any route handler runs

### `infrastructure/`

Third-party client initialization **only** — no ports, no adapters, no business logic.
Deliberately **not** `@Global` so raw clients stay invisible to business modules (the single
exception is CLS, which the library requires to be global).

| Folder | Client |
|--------|--------|
| `database/prisma/` | Prisma write + read services |
| `context/` | CLS module (global) |
| `messaging/` | RabbitMQ, Kafka, SQS publisher adapters |
| `cache/` | Redis / Memcached client |
| `storage/` | S3 client |
| `notification/` | SES, SNS clients |

### `platform/`

Services built on the infrastructure clients, exposed to business code as **ports**.
`PlatformModule` imports every platform sub-module and re-exports them — and it is
**deliberately not `@Global`**: each business module lists `imports: [PlatformModule]`
so the dependency stays visible in module metadata.

| Service | Port | Purpose |
|---------|------|---------|
| `outbox` | `OutboxWriterPort` | Transactional outbox — append events atomically with aggregate changes |
| `events` | `InProcessEventBus` | In-process event bus (EventEmitter2 adapter) |
| `messaging` | `MessageQueuePort` | Publish to RabbitMQ / Kafka / SQS by envelope broker field |
| `inbox` | `InboxPort` | Consumer-side dedupe: receive → complete / fail |
| `context` | `RequestContextPort` | CLS-backed per-request identity/trace; `set`/`get`/`require`/`run` |
| `locking` | `DistributedLockPort` | Redis-based distributed lock with owner-token lease |
| `idempotency` | `IdempotencyPort` + `@Idempotent()` | Insert-as-claim, response replay, expiry purge |
| `numbering` | `NumberingPort` | Race-safe upsert-increment document numbering |
| `audit` | `AuditPort` | Transactional audit rows enriched + redacted from CLS |
| `configuration` | `CompanyConfigPort` | Company configuration resolved from authenticated org |
| `cache` | `CachePort` | Redis or Memcached adapter |
| `notification` | `NotificationDispatchPort` | SES email / SNS push SMS |
| `observability` | `LoggerPort` / `MetricsPort` / `ErrorTrackingPort` | Console logger, Prometheus metrics, Sentry |
| `storage` | `FileStoragePort` | S3 upload/download/delete/metadata/presigned URL |
| `condition-engine` | `ConditionEvaluator` | Generic AND/OR rule gate; field resolvers registered opt-in |
| `scheduler` | `SchedulerPort` | DB-backed scheduled jobs, BullMQ execution, retry escalation |
| `recurring` | — | Recurring templates/executions, TIME+EVENT trigger model |
| `batch-operation` | — | Sync/async bulk transitions, chunk fan-out, claim-token fencing |
| `import` | — | Upload → parse → mapping → validation → execution over S3 |
| `saga` | `SagaInboundPort` | Company-configurable DO/UNDO orchestration over a frozen plan |
| `webhook` | — | Outbound delivery to subscriber URLs + inbound provider webhooks |
| `authentication` | `AuthenticationPort` | Resolves current authenticated identity from request context |
| `authorization` | `RbacPort`, `AbacPort` | Role-based + attribute-based access control |
| `identity` | — | Identity management primitives |

Business code injects the **port abstractions** and never imports concrete platform services
or infrastructure clients.

---

## 3. Business Layer

`shared-business/` holds framework-independent primitives (aggregates, entities, value objects,
events, policies, invariants, registries, factories). Concrete aggregates live under bounded-context
folders (`party`, `procurement`, `sales`). Each context folder has a thin composing module
(`PartyModule`, `ProcurementModule`, `SalesModule`), aggregated by `BusinessModule`. `BusinessModule`
and everything below it may never import `@infrastructure`.

### Aggregate list

| Context | Aggregate | Status machine |
|---------|-----------|---------------|
| `party` | Vendor | ACTIVE → INACTIVE → BLOCKED |
| `procurement` | Product | ACTIVE → INACTIVE → DISCONTINUED |
| `procurement` | PurchaseOrder | DRAFT → SUBMITTED → APPROVED → ISSUED → COMPLETED |
| `procurement` | GoodReceiptNote | DRAFT → RECEIVED → COMPLETED → CANCELLED |
| `sales` | Invoice | DRAFT → POSTED → PAID |

---

## 4. Dependency Direction & ESLint Enforcement

```
HTTP Controller → Use Case → Domain Aggregate + Factory
Use Case → Outbound Ports (company-config, cross-module)
Use Case → Integration Port → OutboxAdapter → OutboxWriterPort (platform)
Use Case → Command Repository Port → Prisma command repo (TransactionHost)
Query Use Case → Query Port → Prisma query repo (PrismaReadPort)
Outbound Port → Consumer Adapter → Producer Module Facade → Query Use Case
OutboxScheduler → PublishPendingBatch → MessageQueuePort → RabbitMQ / Kafka / SQS
OutboxScheduler → InProcessEventBus.emit → in-process listeners
```

### Rules (enforced in `eslint.config.mjs`)

**Allowed:**

| From | May import |
|------|-----------|
| `infrastructure` | third-party clients + config + shared-kernel exceptions only |
| `platform` | infrastructure clients ONLY — zero `@business/**` imports |
| `business module` | its own internals, `@platform` ports, `shared-business`, `shared-kernel` types, another module's `public/**` or `application/outbound-ports/**` contract |

**Forbidden:**

| From | May not import |
|------|---------------|
| `domain` | `@nestjs/common`, `@nestjs/core`, `@nestjs/config`, `@nestjs/event-emitter` |
| `business` | `@infrastructure/**` (always; listeners included) |
| `business` | internals of another module: `domain/**`, `application/queries/**`, `application/usecases/**`, `application/integrations/**`, `application/facades/**`, `infrastructure/**` |
| `shared-business` | `@platform/**`, `@infrastructure/**`, any concrete module (`@business/*/*/**`) |
| `platform` | `@business/**` (ANY, including `shared-business`) |

**Raw client libs** (Prisma, `@prisma/adapter-pg`, `amqplib`, `kafkajs`, `ioredis`/`redis`) →
`infrastructure/config/bootstrap/platform` only. The platform layer may ALSO use
`@golevelup/nestjs-rabbitmq` and `@ssut/nestjs-sqs` (the adapters it wraps) and
`@nestjs/schedule` (the platform owns cron). Business listeners may import the broker packages
ONLY to obtain the subscribe decorators.

The **bare** `@prisma/client` specifier → nowhere; import the generated client by relative path
(`../../../generated/client`). The bare specifier resolves to the npm stub at runtime and breaks
the compiled build.

`@nestjs/schedule` → platform only (the outbox scheduler owns cron).

### Carve-out

`application/integrations/listeners/**` may use the subscribe decorators
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

| Port (token) | Defined in | Implemented by | Used for |
|--------------|-----------|---------------|----------|
| `<Aggregate>CommandRepository` | `domain/repositories/` | `Prisma<Aggregate>CommandRepository` (via `TransactionHost`) | reads/writes of the aggregate inside `@Transactional` |
| `<Aggregate>Query` | `application/queries/` | `Prisma<Aggregate>QueryRepository` (via `PrismaReadPort`) | read-model queries (list/get/purchasable) |
| `<Aggregate>IntegrationPort` | `application/integrations/publishes/` | `OutboxAdapter` (wraps platform `OutboxWriterPort`) | append raised domain events to the outbox |
| `CompanyConfigPort` (module-local) | `application/outbound-ports/` | `CompanyConfigAdapter` (wraps platform `CompanyConfigPort`) | default currency / auto-approve threshold |

Cross-cutting **platform ports** business code injects:

`OutboxWriterPort`, `RequestContextPort`, `NumberingPort`, `AuditPort`,
`NotificationDispatchPort`, `CachePort`, `FileStoragePort`, `LoggerPort`,
`MetricsPort`, `ErrorTrackingPort`, `InProcessEventBus`, `MessageQueuePort`,
`PrismaReadPort`, `DistributedLockPort`, `IdempotencyPort`.

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

3. **Direct injection** — command use cases inject the outbound port token in their constructor;
   Nest resolves the bound adapter at instantiation time (the consuming module `imports`
   the producer module so the public port is resolvable):

```ts
constructor(private readonly vendorQueryPort: OrderableVendorPort) {}
```

Current wiring:

```text
PurchaseOrder ──PurchasableProductPort──▶ ProductModule: ProductForPurchaseFacade
              ──OrderableVendorPort────▶ VendorModule:   VendorForPurchaseFacade
GoodReceiptNote ──PurchaseOrderPort─────▶ PurchaseOrderModule: PurchaseOrderForGrnFacade
```

Nest `imports` are used **only to make exported providers resolvable** — no module ever
reaches into another module's `domain`/`usecases`/`infrastructure`.

---

## 7. Domains / Aggregates

### `shared-business` primitives (framework-free)

```
domain/bases/       AggregateRoot<ID> (version + addEvent/pullEvents drain snapshot),
                    Entity<ID>, ValueObject<T> (equals by props),
                    DomainEvent (eventId/occurredAt/version + correlationId/causationId/headers),
                    DomainFactory<TAggregate, TInput, TProps>
domain/common/value-objects/  Money (minor-units integer math, currency guards),
                    VendorId
domain/registries/  invariantRegistry — keyed Invariant list, enforce() throws on violation
                    policyRegistry     — keyed Policy list, evaluate()/enforce()
```

Aggregates register invariants/policies by importing side-effect files
(`*.invariants.ts`, `policies/*.ts`); rule classes never cross-import aggregates.
`InvariantRegistry.enforce` / `PolicyRegistry.evaluate` THROW on an unknown key — a
guard that was never registered is a loud error, never a silent no-op.

### Product (procurement)

- VOs: `ProductId`, `Sku` (normalized uppercase), `ProductName`; `Money` unit price.
- Status: `ACTIVE | INACTIVE | DISCONTINUED`.
- Behavior: factory `create`, `update`, `changePrice`, `activate`, `deactivate`,
  `discontinue`, `isPurchasable()`.
- Invariants: non-negative price; legal transitions (`DISCONTINUED` has no outgoing transitions).
- Policy: `product.reactivation` — a discontinued product can never be reactivated.
- Events: `ProductCreated/Updated/Activated/Deactivated/Discontinued`.

### Vendor (party)

- VOs: `VendorCode` (uppercase), `VendorName`, `VendorEmail` (lowercase), phone/address props.
- Status: `ACTIVE | INACTIVE | BLOCKED`.
- Behavior: factory `create`, `update`, `activate`, `deactivate`, `block`.
- Policy: `vendor.orderability` — blocked/inactive vendors are never returned by
  `findOrderableById`.
- Events: `VendorCreated/Updated/Activated/Deactivated/Blocked`.

### PurchaseOrder (procurement)

- Owns `PurchaseOrderLine[]` children (same product on a line merges quantities); references
  products/vendors **by id only**.
- Status machine:

```
DRAFT → SUBMITTED → APPROVED → ISSUED → COMPLETED
      ├─ reject → REJECTED
      └──────── cancel → CANCELLED (from DRAFT/SUBMITTED/APPROVED)
```

- Behavior: `addLine`, `removeLine`, `setLine`, `submit`, `approve`, `reject(reason)`, `cancel`,
  `issue`, `amend`, `close`; computed `subtotal`/`total` (`Money`).
- **Amendment** (`amend`): an ISSUED order is not freely editable. Only commercial terms may
  move — expected delivery date and unit price of lines with no receipt against them — reason
  mandatory; the trail (who/when/why) stored on the order and written to the audit log in the
  same transaction. Received quantity is never amended; owned by the receiving balance.
- Invariants: editable only in `DRAFT`, ≥1 line before submit, positive quantity, legal transitions.
- Policy: `purchase-order.can-approve` — submitted orders with `total > autoApproveThreshold`
  (company config) require manual approval.
- Order number: `PO-00000001` style, allocated through `NumberingPort`
  (sequence key `purchase-order.number`, prefix `PO-`, padding 8).
- Events: `PurchaseOrderCreated/Submitted/Approved/Rejected/Issued/Cancelled/Completed/Amended` +
  `LineAdded/LineRemoved`.

### GoodReceiptNote (procurement)

- Owns `GrnLine[]` (productId, orderedQuantity, receivedQuantity, unitPrice; re-receiving the
  same product accumulates received quantity). References PO/vendors by id only.
- Status: `DRAFT | RECEIVED | COMPLETED | CANCELLED`.
- Behavior: `addLine`, `receive` (≥1 line, stamps `receivedAt`), `complete`, `cancel`;
  editable only in `DRAFT`.
- Number: `GRN-00000001` style, allocated through `NumberingPort`
  (sequence key `grn.number`, prefix `GRN-`, padding 8).
- Events: `GrnCreated/LineAdded/Received/Completed/Cancelled`, plus `GoodsReceiptPosted`
  and `GoodsReceiptReversed` — raised by post/reverse use cases for inventory consumers.

### Invoice (sales)

- Invoice aggregate for sales demo; status machine DRAFT → POSTED → PAID.
- Events: `InvoiceCreated/Posted/Paid`.

---

## 8. Outbox, Events & Messaging

### Transactional outbox

Every state-changing use case runs inside `@Transactional()` and appends each raised domain
event to the outbox **in the same DB transaction** as the aggregate change:

```
use case → <Aggregate>IntegrationPort → OutboxAdapter → OutboxWriterPort (platform)
```

| Concept | Detail |
|---------|--------|
| `OutboxWriterPort.append()` | Builds the canonical envelope (`eventType` = domain event class name, JSON payload, headers with `event-id`/`correlation-id`/`causation-id`/`tenant-id`/`broker` from `RequestContextPort`) and saves via `PrismaOutboxRepository` on the caller's `TransactionHost` |
| `PublishPendingBatchUseCase` | Claim batch via `UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED)` over due `PENDING` rows; stamps `claimToken` + `claimedAt`, increments `attempts` |
| Publish flow | Published to `MessageQueuePort` (broker by `envelope.broker`), emitted on `InProcessEventBus` under restored tenant CLS context, CAS-settled |
| Delivery order | Claim order (`createdAt` asc) |
| Statuses | `PENDENT | PUBLISHED | DEAD_LETTER` |
| Retry cadence | Data-driven (`nextRetryAt` + `attempts`), not cron-driven |
| Dead letter | Parks after `OUTBOX_MAX_ATTEMPTS`; terminal, alertable |

### Domain events vs integration events

| | Domain event | Integration event |
|---|-------------|-------------------|
| Scope | In-process, same monolith | Across brokers/processes |
| Transport | `InProcessEventBus` (EventEmitter2) | RabbitMQ / Kafka / SQS |
| Durability | Best effort | Transactional outbox (at-least-once) |
| Persisted | No | `outbox_messages` |

### Broker selection

One messaging port: `MessageQueuePort.publish(envelope)`. The `broker` field on the canonical
envelope picks the transport (default `rabbitmq`). All transports carry the same envelope
(`eventId`, `eventType`, `aggregateType`, `aggregateId`, `payload`, `headers`, `occurredAt`).

### Listeners

Listeners live in `business/<context>/<module>/application/integrations/listeners/` — one
class per transport per module:

| File pattern | Decorator | Transport |
|-------------|-----------|-----------|
| `*.rabbitmq.listener-event.ts` | `@RabbitSubscribe` | RabbitMQ |
| `*.kafka.listener-event.ts` | `@KafkaEvent('<EventType>')` | Kafka |
| `*.sqs.listener-event.ts` | `@SqsMessageHandler('consumer1')` | SQS |
| `*.event-emitter.listener-event.ts` | `@OnEvent('<EventType>')` | In-process |

Handlers must delegate to use cases/facades — never run business logic inline.

---

## 9. Platform Layer

Each sub-system owns its folder, module and ports, and a `README.md` (purpose, public API,
layout, who-calls/how, data & config, tenancy behaviour, rules). `PlatformModule` composes
and re-exports them (not global). `src/platform/README.md` is the service index.

Business opt-in registries are bridged by the **composition root**
`src/bootstrap/configure-*.ts` — generated adapters stay pure port data, no lifecycle, only
platform ports.

See `docs/platform-services.md` for detailed per-service documentation.

---

## 10. Creating a New Business Module

Copy `src/business/procurement/product` as the layout reference:

```
business/<context>/<module>/
├── domain/
│   ├── aggregates/          # aggregate root + <name>.invariants.ts
│   ├── entities/            # child entities + invariants
│   ├── value-objects/       # typed VOs + per-VO invariants
│   ├── events/              # domain events
│   ├── policies/            # policy definitions registered in policyRegistry
│   ├── factories/           # aggregate factory — the only sanctioned build path
│   ├── repositories/        # COMMAND repository port (abstract class = DI token)
│   └── types/               # enums + props/request/query-record type aliases
├── application/
│   ├── usecases/            # one class per command/query operation
│   ├── queries/             # QUERY repository port
│   ├── facades/             # implementations of this module's public/ ports
│   ├── outbound-ports/      # ports this module CONSUMES
│   └── integrations/
│       ├── publishes/       # integration port + per-event wire shapes
│       └── listeners/       # broker/in-process listeners
├── infrastructure/
│   ├── persistence/         # Prisma command/query repositories + domain↔row mapper
│   └── adapters/
│       ├── platform/        # adapters implementing platform-facing ports
│       └── module/          # adapters implementing OTHER modules' outbound ports
├── presentation/
│   └── http/
│       ├── <name>.controller.ts     # thin controllers calling use cases directly
│       ├── requests/                # Zod request DTOs (createZodDto)
│       └── responses/               # Id response + per-endpoint web/mobile Zod response DTOs
├── public/
│   ├── contracts/           # plain reference shapes
│   ├── ports/               # abstract-class port this module EXPORTS
│   └── index.ts             # the only folder other modules may import
└── <module>.module.ts       # NestJS composition root for this aggregate
```

See `docs/service-module-development.md` for step-by-step development guidelines.

---

## 11. Commands

| Command | Purpose |
|---------|---------|
| `npm run start:dev` | Watch mode dev server |
| `npm run build` | Compile to `dist/` |
| `npm run lint` | ESLint + architecture import restrictions (`--fix`) |
| `npm run lint:check` | ESLint + architecture checks (read-only) |
| `npm test` | Unit tests (`--passWithNoTests`) |
| `npm run test:e2e` | E2E smoke (requires `docker compose up -d`) |
| `npm run db:push` | Create/sync database from `prisma/schema` |
| `npm run db:generate` | Regenerate Prisma client into `src/generated/` |
| `npm run db:seed` | Seed products/vendors |
| `npm run docs:di` | Regenerate `docs/DI-WIRING.md` |
| `npm run prisma:studio` | Prisma Studio UI |
