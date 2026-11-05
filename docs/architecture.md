# ERP Boilerplate — Architecture & Reference

NestJS 11 + TypeScript (strict) + Prisma 7 + PostgreSQL. DDD/hexagonal modular monolith with
transactional outbox, RBAC/ABAC authorization, multi-tenancy, and strict business↔infrastructure
boundaries enforced by ESLint.

## Top-level folder map

```
src/
├── app.module.ts            # root composition root + global interceptors/filter/pipe
├── main.ts                  # entry point, calls bootstrap()
├── config/                  # .env-driven typed configuration blocks + ConfigService facade
├── shared-kernel/           # technical NestJS concerns (filters, interceptors, pipes,
│                            # decorators, exceptions, types, middleware, guards)
├── bootstrap/               # app bootstrap steps + composition-root bridges
├── infrastructure/          # third-party client init ONLY (Prisma, Redis, RabbitMQ,
│                            # Kafka, SQS, SES, S3, CLS)
├── platform/                # services exposed as ports (outbox, events, messaging,
│                            # context, cache, audit, numbering, configuration,
│                            # notification, observability, storage, condition-engine,
│                            # locking, idempotency, scheduler, recurring, batch-operation,
│                            # import, saga, webhook, authentication, authorization, identity)
├── generated/               # Prisma-generated client (DO NOT EDIT)
└── business/
    ├── shared-business/     # framework-independent domain primitives + registries
    ├── party/vendor/                    # Vendor aggregate       (context: party)
    ├── procurement/product/             # Product aggregate      (context: procurement)
    ├── procurement/purchase-order/      # PurchaseOrder aggregate (context: procurement)
    ├── procurement/good-receipt-note/   # GoodReceiptNote aggregate (context: procurement)
    └── sales/invoice/                   # Invoice aggregate       (context: sales)
```

Module aliases: `@config/*`, `@shared-kernel/*`, `@bootstrap/*`, `@infrastructure/*`,
`@platform/*`, `@business/*`, `@test/*`, `@prisma/client` → `src/generated/client.ts`

## Layers

### `config/`
Only place that reads `process.env`. Typed `registerAs` blocks loaded by `@Global` ConfigModule.
`ConfigService` is a typed facade — adapters use `getPostgres()`, `getRabbitMQ()`, etc.

### `shared-kernel/`
Technical NestJS concerns: filters, interceptors, pipes, guards, exceptions, types, middleware,
decorators. Domain folders import no `@nestjs/*`.

### `bootstrap/`
Composes bootstrap steps from `main.ts`: Sentry, NestFactory, security, CORS, HTTP, shutdown,
Swagger, server, plus composition-root bridges (`configureBatchOperations`, `configureImports`,
`configureNotifications`, `configureWebhooks`) and `CompanyConfigContextMiddleware` registration.

### `infrastructure/`
Third-party client initialization only — no ports, no adapters, no business logic. Not `@Global`
(except CLS).

### `platform/`
Services built on infrastructure clients, exposed as **ports**. `PlatformModule` imports and
re-exports all sub-modules (not `@Global`). Each business module lists `imports: [PlatformModule]`.

Key ports: `OutboxWriterPort`, `InProcessEventBus`, `MessageQueuePort`, `InboxPort`,
`RequestContextPort`, `DistributedLockPort`, `IdempotencyPort` + `@Idempotent()`,
`NumberingPort`, `AuditPort`, `CompanyConfigPort`, `CachePort`,
`NotificationDispatchPort`, `LoggerPort`/`MetricsPort`/`ErrorTrackingPort`,
`FileStoragePort`, `AuthenticationPort`, `RbacPort`, `AbacPort`.

### `business/`
`shared-business/` holds framework-independent primitives. Aggregates under `party/`,
`procurement/`, `sales/`, aggregated by `BusinessModule`. May never import `@infrastructure`.

## Dependency direction (ESLint-enforced)

```
Controller → Use Case → Domain + Factory → Command Repository Port → Prisma (TransactionHost)
Use Case → Outbound Ports → Producer Facade → Query Use Case → Query Port → PrismaReadPort
Use Case → Integration Port → OutboxAdapter → OutboxWriterPort → outbox_messages
OutboxScheduler → PublishPendingBatch → MessageQueuePort → RabbitMQ/Kafka/SQS
OutboxScheduler → InProcessEventBus.emit → in-process listeners
```

### Import rules

| From | May import | May not import |
|------|-----------|---------------|
| `infrastructure` | clients + config + shared-kernel exceptions | — |
| `platform` | infrastructure clients ONLY | `@business/**` (ANY) |
| `business module` | own internals, `@platform` ports, `shared-business`, `shared-kernel`, another module's `public/**` or `application/outbound-ports/**` | `@infrastructure/**`, another module's internals |
| `shared-business` | framework-independent primitives only | `@platform/**`, `@infrastructure/**`, `@business/*/*/**` |

## Ports & adapters

Every port is an abstract class used as its own DI token; modules bind with `useClass`/`useExisting`.

Per aggregate: `*CommandRepository` (domain), `*Query` (application/queries), `*IntegrationPort`
(application/integrations/publishes), `CompanyConfigPort` (application/outbound-ports).

Use cases inject the abstract class; the module binds the concrete adapter.

## Business module anatomy

```
business/<context>/<module>/
├── domain/        aggregates, entities, value-objects, events, policies, factories,
│                  repositories, types
├── application/   usecases, queries, facades, outbound-ports,
│                  integrations/publishes, integrations/listeners
├── infrastructure/
│   ├── persistence/prisma/   # repos + mappers
│   └── adapters/             # platform + module adapters
├── presentation/http/
│   ├── <name>.controller.ts  # thin, calls use cases directly
│   ├── requests/             # Zod request DTOs (createZodDto)
│   └── responses/            # web/mobile Zod response DTOs
├── public/
│   ├── contracts/, ports/, index.ts   # only folder other modules may import
└── <module>.module.ts        # bindings/exports only
```

### Command use case pattern

1. Read context from `RequestContextPort` (CLS) — never inject `AuthenticationPort` or
   `CompanyConfigPort` directly.
2. Call `AbacPort.evaluate()` before business steps.
3. Orchestrate factory → aggregate → repository port → outbox.
4. `@Transactional()` on `execute()`.

### Aggregate list

| Context | Module | Aggregate | Natural key (unique per company) |
|---------|--------|-----------|----------------------------------|
| party | vendor | Vendor | code |
| procurement | product | Product | sku |
| procurement | purchase-order | PurchaseOrder | orderNumber |
| procurement | good-receipt-note | GoodReceiptNote | grnNumber |
| sales | invoice | Invoice | invoiceNo |

## Tenancy

Every business table carries `tenantId`/`companyId`, stamped from request context on create,
filtered on every read/write. Foreign row = 404 (never 403). Natural key unique within company,
not globally. Two companies each have `PO-00000001`.

## Authentication / Authorization / Tenancy

### Tenancy modes
- `single` (default): `x-tenant-id`/`x-company-id` headers trusted (dev/internal/verified gateway).
- `multi`: JWT required with `tenantId` claim; raw headers ignored; anonymous rejected
  (except `@SkipTenancy()` routes).

### CLS RequestContext
Fields: `requestId`, `correlationId`, `tenantId`, `companyId`, `userId`, `roles`, `locale`,
`ip`, `userAgent`, `defaultCurrency`, `autoApproveThreshold`, `overReceiptTolerance`.

### Middleware
`CompanyConfigContextMiddleware` reads `x-company-id`, resolves `CompanyConfigPort`, stamps
company config fields into CLS `RequestContext`. Runs before route handlers.

### Interceptor
`RequestIdInterceptor` generates `requestId`/`correlationId`, seeds CLS via
`RequestContextPort.set()` (merge, preserves company config fields).

### Guards
- `TenancyAuthGuard` (global `APP_GUARD`): enforces tenancy boundary.
- `RbacGuard` (global `APP_GUARD`): reads `@Rbac()` metadata, resolves `userId` from CLS,
  calls `RbacPort.can()`.

### Decorator
`@Rbac(resource, action)` on route handlers.

### ABAC (usecase level)
Every command use case calls `AbacPort.evaluate()` with CLS-derived context before business
steps. `AbacResult` = `{ decision: 'ALLOW' | 'DENY', scopeFilter?, reason? }`.

### No-op adapters (IAM deferred)
`AuthenticationPort` → returns `null`; `RbacPort` → returns `true`; `AbacPort` → returns
`{ decision: 'ALLOW', scopeFilter: {} }`. Bound via `useExisting` in `AuthenticationModule`/
`AuthorizationModule`. Replace with real implementations when IAM is built.

## Outbox, events & messaging

State-changing use cases run `@Transactional()` and append domain events to the outbox in the
same DB transaction:

```
use case → <Aggregate>IntegrationPort → OutboxAdapter → OutboxWriterPort → outbox_messages
```

`OutboxScheduler` ticks, claims due `PENDING` rows via `FOR UPDATE SKIP LOCKED`, publishes to
`MessageQueuePort`, emits on `InProcessEventBus`, CAS-settles. Statuses: `PENDING` /
`PUBLISHED` / `DEAD_LETTER`. At-least-once delivery; consumers dedupe on `event-id`.

Canonical envelope: `eventId`, `eventType`, `aggregateType`, `aggregateId`, `payload`,
`headers` (`event-id`, `correlation-id`, `causation-id`, `tenant-id`, `broker`), `occurredAt`.

Broker picked by `envelope.broker` (default `rabbitmq`). RabbitMQ → topic exchange `erp.events`;
Kafka → topic = event type; SQS → configured queue.

Listeners in `application/integrations/listeners/`: `*.rabbitmq.listener-event.ts`,
`*.kafka.listener-event.ts`, `*.sqs.listener-event.ts`, `*.event-emitter.listener-event.ts`.
Handlers delegate to use cases/facades — never inline business logic.

## Data model

Prisma schema split per context under `prisma/schema/<context>/`, aggregated by
`prisma/schema/schema.prisma`. **No migrations** — `npm run db:push` creates/syncs from schema;
`npx prisma generate` regenerates client to `src/generated/`.

Physical column names not uniform: `outbox_messages`, `inbox_messages`, `saga_steps` are
snake_case; the rest camelCase. Hand-written `$queryRaw` must use physical column names.

## Verification battery (run after any change)

```bash
npx tsc --noEmit -p tsconfig.json
npm run lint:check
npm run format:check
npm run docs:di
npm run build
NODE_ENV=test node -e "(async()=>{const{NestFactory}=require('@nestjs/core');const{AppModule}=require('./dist/app.module.js');const a=await NestFactory.create(AppModule,{preview:true});await a.init();await a.close();})()"
```

## Commands

| Command | Purpose |
|---------|---------|
| `npm run start:dev` | watch mode dev server |
| `npm run build` | compile to `dist/` |
| `npm run lint` | ESLint + architecture rules (`--fix`) |
| `npm run lint:check` | ESLint + architecture checks |
| `npm run format:check` | prettier |
| `npm test` | unit tests (`--passWithNoTests`) |
| `npm run test:e2e` | e2e smoke (requires `docker compose up -d`) |
| `npm run db:push` | create/sync database from schema |
| `npm run db:generate` | regenerate Prisma client |
| `npm run db:seed` | seed products/vendors |
| `npm run docs:di` | regenerate DI wiring docs |
| `npm run prisma:studio` | Prisma Studio UI |

## Open work

- **IAM / Auth deferred**: RBAC/ABAC ports exist with no-op adapters; real implementation pending.
- **Optimistic concurrency**: implemented on PurchaseOrder and GRN only; Vendor/Product/Invoice
  command repos are last-write-wins.

## Commit hygiene

- Do not commit secrets or `.env`.
- Never edit `src/generated/**`.
- Public contracts change only with explicit owner approval.
- Commit only when explicitly requested.
