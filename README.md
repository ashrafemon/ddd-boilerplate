# ERP Modular Monolith Boilerplate

A production-grade **ERP backend boilerplate** built with **NestJS + TypeScript** using
**Domain-Driven Design (DDD)**, **Hexagonal Architecture (Ports & Adapters)**,
**Clean Architecture** and a **Modular Monolith** style, with **CQRS-style
read/write separation**, **transactional Outbox**, **Saga/Workflow orchestration**,
**multi-tenancy** and strict **architectural dependency rules**.

> The goal is not a CRUD starter. It is a reusable ERP foundation where every
> business module is an independent bounded context behind explicit ports.

---

## Table of Contents

1. [Architecture at a Glance](#architecture-at-a-glance)
2. [Ports & Adapters: The Two Kinds of Ports](#ports--adapters-the-two-kinds-of-ports)
3. [Cross-Module Communication](#cross-module-communication)
4. [Directory Structure](#directory-structure)
5. [Implemented Bounded Contexts](#implemented-bounded-contexts)
6. [Infrastructure Clients](#infrastructure-clients)
7. [Transaction Management](#transaction-management)
8. [Outbox / Events / Messaging](#outbox--events--messaging)
9. [Tenancy](#tenancy)
10. [Observability](#observability)
11. [Dependency Rules](#dependency-rules)
12. [Getting Started](#getting-started)
13. [Testing](#testing)
14. [Architecture Validation](#architecture-validation)
15. [Adding a New Bounded Context](#adding-a-new-bounded-context)
16. [Security Notes](#security-notes)
17. [Roadmap](#roadmap)

---

## Architecture at a Glance

```
                ┌──────────────────────┐
                │     Presentation     │   Controllers / HTTP
                └──────────┬───────────┘
                           │
                           ▼
                ┌──────────────────────┐
                │   Application Port   │   Public capability of a module
                └──────────┬───────────┘
                           │
                           ▼
                ┌──────────────────────┐
                │  UseCase / Facade    │   Orchestration only
                └──────────┬───────────┘
                           │
              ┌────────────┼─────────────┐
              ▼            ▼             ▼
        Domain Service  Invariant      Policy
              └────────────┼─────────────┘
                           │
                           ▼
                         Aggregate         Encapsulated domain state
                           │
                           ▼
                       Domain Port         The module's own requirement
                           │
                           ▼
                  Infrastructure Adapter
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
        Prisma (R/W)    Redis            AWS / brokers
```

Cross-module:

```
   PURCHASE MODULE                     VENDOR MODULE
       │                                    │
       ▼                                    │
  VendorLookupPort  ◄── owned by purchase   │
       │                                    │
       ▼                                    │
  VendorLookupAdapter  ──► ModulePortAccessor
                               │            │
                               ▼            ▼
                        GetVendorPort  ◄─ GetVendorUseCase (vendor context)
```

---

## Ports & Adapters: The Two Kinds of Ports

### 1. Domain Ports — `modules/<module>/domain/port/`

Dependencies **required by the module itself**.

- `PurchaseOrderWriteRepositoryPort`
- `VendorLookupPort` (purchase needs vendor data)
- `ProductLookupPort` (purchase needs product data)
- `OrganizationConfigurationPort` (purchase needs approval limits)
- `OutboxPort` (transactional outbox)

The **consumer owns the port**. `purchase/domain/port/vendor-lookup.port.ts`
belongs to Purchase, **not** to Vendor.

### 2. Application Ports — `modules/<module>/application/port/`

Capabilities a module **exposes to other modules**.

- `vendor/application/port/get-vendor.port.ts`
- `product/application/port/get-product.port.ts`
- `purchase/application/port/create-purchase-order.port.ts`

Application ports are implemented by UseCases or Facades and bound with:

```ts
{ provide: GetVendorPort, useExisting: GetVendorUseCase }
```

### Ports are abstract classes (never Symbols or raw interfaces)

```ts
export abstract class VendorLookupPort {
  abstract findForPurchase(input: VendorLookupInput): Promise<VendorLookupOutput>;
}
```

NestJS uses the abstract class as the DI token. No `Symbol()` tokens anywhere.

---

## Cross-Module Communication

Modules **never** import each other's use cases, facades, repositories,
entities, or infrastructure classes. The flow is always:

1. The consuming module declares a **domain port** (`VendorLookupPort`).
2. Its infrastructure provides an **outbound adapter** (`VendorLookupAdapter`).
3. The adapter resolves the provider's **application port** through
   `ModulePortAccessor` (which internally wraps NestJS `ModuleRef`).
4. The adapter translates between the two contracts.

```ts
@Injectable()
export class VendorLookupAdapter implements VendorLookupPort {
  constructor(private readonly portAccessor: ModulePortAccessor) {}

  async findForPurchase(input: VendorLookupInput): Promise<VendorLookupOutput> {
    const vendorPort = this.portAccessor.resolve(GetVendorPort);
    const vendor = await vendorPort.execute({ vendorId: input.vendorId });
    return { /* translate */ };
  }
}
```

`ModulePortAccessor` lives in `shared-kernel/port/`; its `ModuleRef`-based
implementation is the only place NestJS `ModuleRef` appears.

---

## Directory Structure

```
src/
├── app/                        # AppModule + middleware wiring
├── modules/
│   ├── vendor/                 # Bounded context: vendor
│   │   ├── domain/
│   │   │   ├── aggregate/  entity/  value-object/
│   │   │   ├── invariant/  policy/  event/
│   │   │   ├── port/             # domain-owned ports (repos, outbox)
│   │   │   └── service/          # domain builders
│   │   ├── application/
│   │   │   ├── use-case/  facade/  dto/
│   │   │   └── port/             # public application ports
│   │   ├── presentation/http/    # controller/ request/ response
│   │   ├── infrastructure/
│   │   │   ├── persistence/      # read/ + write/ adapters, mappers
│   │   │   └── outbound/         # cross-module adapters
│   │   └── vendor.module.ts
│   ├── product/                # Bounded context: product
│   └── purchase/               # Bounded context: purchase order
├── platform/                   # Cross-module orchestration
│   ├── tenant/  organization/  transaction/  outbox/
│   ├── workflow/  saga/  messaging/  cache/
│   ├── notification/  storage/  idempotency/  health/
│   └── platform.module.ts
├── shared-business/            # Reusable business concepts
│   ├── domain/                 # Entity, AggregateRoot, ValueObject, Identifier
│   ├── value-object/           # Money, Currency, Quantity, TaxRate, EmailAddress...
│   ├── invariant/  policy/  event/
│   └── port/
├── shared-kernel/              # Technical NestJS infrastructure
│   ├── config/  context/  filter/  pipe/  interceptor/  guard/
│   ├── decorator/  dto/  exception/  logging/  observability/
│   ├── port/                   # ModulePortAccessor
│   └── shared-kernel.module.ts
└── infrastructure/             # Shared technical adapters
    ├── database/prisma/        # PrismaWriteService + PrismaReadService
    ├── cache/  messaging/  notification/  storage/  outbox/  idempotency/
    └── ...
```

Domain boundaries are strict: no `common/service` god-object holding business
logic. Business logic belongs to its bounded context.

---

## Implemented Bounded Contexts

### Vendor
Aggregate: `Vendor` (addresses, contacts, bank accounts).
Value objects: `VendorId`, `VendorCode`, `VendorStatus`, `TaxIdentifier`, `Iban`.
Capabilities: `CreateVendor`, `GetVendor`, `UpdateVendor`, `ActivateVendor`,
`DeactivateVendor`, `ValidateVendor` — all exposed as application ports.

### Product
Aggregate: `Product`. Value objects: `ProductId`, `Sku`, `ProductUnit`,
`ProductStatus`, `Money`.
Capabilities: `CreateProduct`, `GetProduct`, `UpdateProduct`,
`ActivateProduct`, `DeactivateProduct`.

### Purchase
Aggregate: `PurchaseOrder` with `PurchaseOrderLine` children. Value objects:
`PurchaseOrderId`, `PurchaseOrderNumber`, `PurchaseOrderStatus`,
`VendorReference`, `ProductReference`.

Statuses: `DRAFT → SUBMITTED → APPROVED → COMPLETED`, `SUBMITTED → REJECTED`,
`DRAFT/SUBMITTED → CANCELLED`. Invariants and policies are explicit classes:

- Invariants: `PurchaseOrderMustHaveLines`, `PurchaseOrderTotalMustMatchLines`,
  `PurchaseOrderCannotBeApprovedTwice`, `PurchaseOrderStatusTransition`
- Policies: `PurchaseApprovalPolicy`, `PurchaseLimitPolicy`,
  `VendorSelectionPolicy`, `ProductPurchasabilityPolicy`

Capabilities: create / update / get / submit / approve / reject / cancel /
complete, plus a `PurchaseOrderLifecycleFacade` that runs the post-approval
**saga**.

Purchase reaches Vendor and Product **only** through `VendorLookupPort` /
`ProductLookupPort`, implemented by outbound adapters over
`ModulePortAccessor`.

---

## Infrastructure Clients

| Concern            | Technology                                                                   | Abstraction / Port                          |
| ------------------ | ---------------------------------------------------------------------------- | ------------------------------------------- |
| Database (write)   | Prisma — `PrismaWriteService` (extends `PrismaClient`)                       | `PurchaseOrderWriteRepositoryPort`, ...     |
| Database (read)    | Prisma — `PrismaReadService` (separate replica connection)                   | `*ReadRepositoryPort`                       |
| Transactions       | `nestjs-cls` + `@nestjs-cls/transactional` + Prisma adapter                  | `TransactionManagerPort`                    |
| Request context    | `nestjs-cls` (CLS)                                                           | `RequestContextPort`                        |
| Cache              | `ioredis` or `@andreafspeziale/nestjs-memcached` (selectable via env)        | `CachePort` + `buildCacheKey`               |
| In-process events  | `@nestjs/event-emitter` (EventEmitter2)                                      | `EventBusPort`                              |
| Messaging          | `@golevelup/nestjs-rabbitmq`, `kafkajs`, `@aws-sdk/client-sqs`               | `MessagePublisherPort`, `IntegrationMessageRouter` |
| Notifications      | `@aws-sdk/client-sns`                                                        | `NotificationPort`                          |
| Email              | `@aws-sdk/client-ses`                                                        | `EmailPort`                                 |
| File storage       | `@aws-sdk/client-s3` (+ presigned URLs)                                      | `FileStoragePort`                           |
| Error tracking     | `@sentry/node` (lazy init)                                                   | `ErrorTrackingPort`                         |
| Metrics            | `prom-client` (default metrics + custom)                                     | `MetricsPort`                               |
| Logs               | `pino` (structured) / optional `loki` pusher                                 | `LoggerPort`                                |
| Health             | `@nestjs/terminus` (DB, Redis, RabbitMQ, Kafka)                              | `HealthController` at `/api/health`         |

Business code never touches `ioredis`, `kafkajs`, `@aws-sdk/*`, `prisma`,
`ModuleRef` or the RabbitMQ client directly — it always goes through a port.

All messaging/cache/AWS clients self-disable when their `*_ENABLED` env flag is
off, so local development needs no external services (except Postgres).

---

## Transaction Management

- `nestjs-cls` provides the CLS store and a global middleware.
- `@nestjs-cls/transactional` with the **Prisma adapter** makes
  `TransactionHost.tx` return the transactional client when a transaction is
  active and the plain client otherwise.
- `TransactionManagerPort` wraps `TransactionHost`. Write use cases wrap their
  work in `withTransaction(...)`; write repositories obtain the transactional
  client via `transactionManager.getClient<Prisma.TransactionClient>()`.
- No transaction objects are ever passed through method signatures.

```
UseCase ──► TransactionManagerPort ──► TransactionHost ──► Prisma $transaction (CLS)
Repository ──► getClient() (joins the same transaction automatically)
```

---

## Outbox / Events / Messaging

```
UseCase ──► Aggregate mutation ──► save via write repository
              + outbox.appendMany(domain events)        ← same transaction
commit ──► OutboxDispatcherService (polls PENDING)
              ──► MessagePublisherPort (RabbitMQ / Kafka / SQS)
              ──► consumer (RabbitMQ/Kafka/SQS)
                    ──► IntegrationMessageProcessor (restores CLS context)
                          ──► Inbox idempotency (unique messageId+eventType)
                                ──► IntegrationMessageRouter
                                      ──► module handlers ──► application ports
```

- Domain events are raised by the aggregate; the **application** turns them
  into outbox rows atomically with the aggregate save.
- Integration events are published **after** the transaction commits.
- The outbox supports status, attempt count, error capture, exponential
  retry, processing lock, dead-lettering after `OUTBOX_MAX_ATTEMPTS`.
- Consumers are idempotent via the `InboxEvent` table.
- RabbitMQ uses `@golevelup/nestjs-rabbitmq` decorators
  (`@RabbitSubscribe`), `Nack`-based acking and a dead-letter exchange.
- Kafka forwards failures to a dead-letter topic. SQS relies on visibility
  timeout + queue redrive policy.

Example consumer-side handler: `PurchaseOrderApprovedIntegrationHandler`
registers itself in `IntegrationMessageRouter` and demonstrates the
`Event provider → Consumer → Application port` flow (an ERP would resolve the
Inventory module's port here).

---

## Tenancy

- Tenant and Organization are **separate platform concepts** (`platform/tenant`,
  `platform/organization`). One tenant may contain many organizations.
- The `RequestContextMiddleware` reads `{TENANT_HEADER}` and
  `{ORGANIZATION_HEADER}` (defaults `x-tenant-id`, `x-organization-id`) and
  stores them in CLS.
- Read repositories scope queries by the current tenant.
- Outbox records, inbox records and all aggregate rows carry
  `tenantId`/`organizationId`; composite indexes cover
  `(tenantId, organizationId, ...)` access patterns.
- Message consumers re-establish tenant/organization from message metadata
  before invoking use cases.

---

## Observability

Every request/message keeps `requestId`, `correlationId`, `tenantId`,
`organizationId`. The HTTP flow:

```
HTTP ──► RequestContextMiddleware ──► CLS ──► UseCase ──► DB / Outbox
              │
              └──► pino log lines with correlation/tenant fields
                   ──► Prometheus counters/histograms
                   ──► Sentry (lazy, env-gated)
```

Never log secrets: the pino adapter redacts `password`, `secret`, `token`,
`authorization`, `apiKey`, `key`.

---

## Dependency Rules

Enforced by `scripts/architecture-rules.ts` (jest spec + `npm run arch:check`):

1. Domain must not import `infrastructure/`, `platform/`, Prisma, brokers, AWS,
   `@nestjs/core`, observability clients.
2. Application must not import `infrastructure/`, Prisma, `@nestjs/core`
   (`ModuleRef`), brokers, AWS.
3. Presentation must not import domain, infrastructure, Prisma.
4. Modules must not import other modules — **except** outbound adapters
   (`modules/<m>/infrastructure/outbound`) may import another module's
   `application/port`.
5. `shared-business`, `shared-kernel`, `platform` never depend on `modules`.

Also enforced by convention and by the architecture spec:

- No `Symbol` DI tokens — abstract classes are the tokens.
- No `class-validator` — **Zod** is used for input validation; domain
  invariants handle business correctness.
- Controllers contain no business logic — they call application ports.
- Prisma models are never used as domain objects (explicit mappers:
  `toDomain`/`toPersistence`).

---

## Getting Started

### 1. Requirements

Node 20+, npm, Docker (for the database).

### 2. Infrastructure

```bash
docker compose up -d postgres redis rabbitmq kafka memcached
cp .env.example .env        # adjust values if needed
```

### 3. Database

```bash
npm install
npm run prisma:generate
npm run prisma:migrate -- --name init   # creates + applies the first migration
npm run prisma:seed                     # DEMO tenant/org, a vendor, a product
```

### 4. Run

```bash
npm run start:dev
```

The API listens on `http://localhost:3000/api`. Health: `GET /api/health`.

### 5. Try the full cross-module flow

```bash
T="x-tenant-id: <tenant-id>"; O="x-organization-id: <org-id>"
U="x-user-id: u-1"; R="x-roles: purchase.admin,purchase.manager,product.manager"

# create a vendor
curl -X POST http://localhost:3000/api/vendors -H "$T" -H "$O" -H "$U" -H "$R" \
  -H "Content-Type: application/json" \
  -d '{"code":"V-0002","name":"Acme","email":"a@b.c"}'

# create a product
curl -X POST http://localhost:3000/api/products -H "$T" -H "$O" -H "$U" -H "$R" \
  -H "Content-Type: application/json" \
  -d '{"code":"P-0002","name":"Widget","sku":"W-2","unit":"EA","priceCents":1200,"currency":"USD"}'

# create a purchase order (resolves vendor+product through module ports)
curl -X POST http://localhost:3000/api/purchase-orders -H "$T" -H "$O" -H "$U" -H "$R" \
  -H "Content-Type: application/json" \
  -d '{"vendorId":"<vendor-id>","lines":[{"productId":"<product-id>","quantity":5,"taxRateBps":100}]}'

# lifecycle
curl -X POST http://localhost:3000/api/purchase-orders/<po-id>/submit  -H "$T" -H "$O" -H "$U" -H "$R"
curl -X POST http://localhost:3000/api/purchase-orders/<po-id>/approve -H "$T" -H "$O" -H "$U" -H "$R" -d '{}'
```

`<tenant-id>` and `<org-id>` come from the seed output (query
`Tenant`/`Organization` tables) or your own records.

---

## Testing

```bash
npm test              # unit + architecture tests (jest)
npm run test:cov
npm run arch:check    # standalone architecture dependency check
npm run lint
```

Tests cover:

- **Domain**: value objects (`Money`, `Quantity`, `TaxRate`), the
  `PurchaseOrder` aggregate lifecycle, invariants and policies.
- **Application**: `CreateVendorUseCase`, `CreatePurchaseOrderUseCase`
  (cross-module through mocked ports), `PurchaseOrderLifecycleFacade`.
- **Cross-module boundaries**: `VendorLookupAdapter` / `ProductLookupAdapter`
  resolved through a mocked `ModulePortAccessor` against mocked application
  ports — never against concrete use cases.
- **Architecture**: the dependency rules above, run over the whole `src` tree.

---

## Architecture Validation

```
npm run arch:check
```

Runs the same rules as the jest `dependency-rules` spec and fails the build if
a boundary is crossed. Add it to CI.

---

## Adding a New Bounded Context

1. `modules/<name>/domain/…` — aggregates, entities, value objects,
   invariants, policies, events, **domain ports** (repositories, lookups,
   outbox).
2. `modules/<name>/application/…` — DTOs, ports (public capabilities),
   use cases, facades. Implement each application port with a use case.
3. `modules/<name>/presentation/http/…` — controller, Zod request schemas,
   response DTOs. Controllers call application ports only.
4. `modules/<name>/infrastructure/…` — persistence mappers + read/write
   adapters; outbound adapters for cross-module needs (via
   `ModulePortAccessor`).
5. `<name>.module.ts` — bind domain ports to adapters and application ports to
   use cases/facades; export only the application ports.
6. Register the module in `AppModule`.
7. Add any new domain/invariant/policy classes to the test suite and run
   `npm run arch:check`.

Example port binding:

```ts
{ provide: PurchaseOrderWriteRepositoryPort, useClass: PrismaPurchaseOrderWriteRepositoryAdapter }
{ provide: CreatePurchaseOrderPort, useExisting: CreatePurchaseOrderUseCase }
```

---

## Security Notes

- This boilerplate ships a **demo authentication guard** (`AuthGuard`) that
  reads `x-user-id`/`x-roles` headers for local development. In production,
  replace it with your identity provider while keeping the same
  `RequestContextPort` contract.
- Authorization is enforced at multiple layers: route roles, business
  policies (`PurchaseApprovalPolicy` …) and tenant-scoped repositories.
- Prisma errors are never leaked to clients — the global exception filter maps
  domain/application exceptions to a structured error envelope.

---

## Roadmap

Suggested next bounded contexts (same pattern as above): `sales`, `customer`,
`inventory`, `warehouse`, `accounting`, `finance`, `payment`, `procurement`,
`manufacturing`, `shipment`, `employee`, `hr`, `tax`, `currency`, `pricing`.

Typical integration points already provided:

- `Inventory reservation` after PO approval → step inside
  `PurchaseOrderApprovalSaga`, resolving the inventory module's application
  port through `ModulePortAccessor`.
- `Accounting entry` on receipt → a `purchase.order.completed` integration
  handler inside the accounting module.
- `Notification` fan-out → `NotificationPort` (SNS) / `EmailPort` (SES).
