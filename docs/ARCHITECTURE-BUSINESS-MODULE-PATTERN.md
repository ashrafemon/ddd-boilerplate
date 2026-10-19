# Architecture and Business Module Structure & Pattern

> Condensed, implementation-grounded summary of `ARCHITECTURE.md` (§1–§7, §15)
> and `docs/BUSINESS-MODULE-GUIDE.md`. Reference implementation:
> `src/business/procurement/product`. Flow details live in `docs/FLOWCHARTS.md`;
> platform-service recipe lives in `docs/PLATFORM-SERVICE-GUIDE.md`.

Stack: **NestJS 11 + TypeScript (strict) + Prisma 7 + PostgreSQL**, event-driven
**modular monolith**. Design: **DDD + Hexagonal (Ports & Adapters) + Clean
Architecture + lightweight CQRS** (command repository vs query repository split).
Side effects leave the process via the **transactional outbox** only.

## 1. Top-level folder map

```text
src/
├── app.module.ts            # root composition root + global pipe/filter/interceptors
├── main.ts / bootstrap/     # bootstrap steps (sentry, security, cors, http, swagger, server)
├── config/                  # ONLY place reading process.env (typed registerAs + ConfigService facade)
├── shared-kernel/           # technical Nest concerns: filters, interceptors, pipes, decorators,
│                            # exceptions (DomainException), types, utils (KeyedRegistryBase)
├── infrastructure/          # third-party client init ONLY (Prisma, brokers, cache, AWS, CLS, queue)
├── platform/                # services on infra clients, exposed as port abstractions
│                            # (outbox, events, messaging, context, locking, idempotency, cache,
│                            #  configuration, audit, numbering, notification, observability,
│                            #  storage, condition-engine, scheduler, recurring, batch-operation, import)
├── generated/               # Prisma-generated client — DO NOT EDIT
└── business/
    ├── shared-business/     # framework-free domain primitives + registries
    ├── party/vendor/                    # Vendor aggregate        (context: party)
    ├── procurement/product/             # Product aggregate       (context: procurement) ← reference
    ├── procurement/purchase-order/      # PurchaseOrder aggregate (context: procurement)
    ├── procurement/good-receipt-note/   # GoodReceiptNote aggregate
    └── sales/invoice/                   # Invoice aggregate       (context: sales)
```

Aliases (`tsconfig.json`): `@config`, `@shared-kernel`, `@bootstrap`,
`@infrastructure`, `@platform`, `@business`, `@test`, `@prisma/client`.

Context composition: each bounded-context folder has a thin composing module
(`PartyModule`, `ProcurementModule`, `SalesModule`), aggregated by
`BusinessModule` (`src/business/business.module.ts`).

## 2. Layer responsibilities and dependency direction

```text
HTTP Controller → Use Case → Domain (Aggregate + Factory)
Use Case → Outbound Ports + Integration Port → OutboxAdapter → OutboxWriterPort (platform)
Use Case → Command Repository Port → Prisma command repo (TransactionHost, @Transactional tx)
Query Use Case → Query Port → Prisma query repo (PrismaReadPort, replica)
Consumer adapter (own infra/adapters/module) → Producer facade (producer application/facades)
OutboxScheduler tick → PublishPendingBatch (SKIP LOCKED claim) → MessageQueuePort
  → RabbitMQ / Kafka / SQS + InProcessEventBus re-dispatch
```

Rules (enforced by `eslint.config.mjs` — `npm run lint:check`):

- `domain/**`: zero `@nestjs/*`, zero `@platform/**`, zero `@infrastructure/**`.
- `business/**` → never `@infrastructure/**`; never another module's internals
  (`domain/**`, `application/usecases|queries|integrations|facades`, `infrastructure/**`).
  Allowed cross-module imports: another module's `public/**` or
  `application/outbound-ports/**` contract only.
- `platform/**` → never `@business/**`. Platform owns its event contract
  (`OutboxEvent` structural interface + canonical `OutboxEnvelope` in
  `@platform/outbox/outbox.types`); business `DomainEvent` satisfies it
  structurally and the payload is delivered verbatim — no rehydration.
- Raw clients (`prisma`, `amqplib`, `kafkajs`, `ioredis`, …) →
  `infrastructure/config/bootstrap/platform` only. `@nestjs/schedule` → platform only.
- Carve-out: `application/integrations/listeners/**` may use subscribe decorators
  (`@RabbitSubscribe`, `@KafkaEvent`, `@SqsMessageHandler`, `@OnEvent`) but must
  delegate to use cases — no inline business logic.
- Every port is an **abstract class used as its own DI token**; module binds with
  `useClass` / `useExisting`. `PlatformModule` is deliberately **not `@Global`** —
  each business module declares `imports: [PlatformModule]`.

## 3. Business module anatomy (one aggregate = one module)

Canonical tree (verified against `procurement/product`):

```text
business/<context>/<module>/               # e.g. business/procurement/product/
├── <module>.module.ts                     # Nest composition root: bindings/exports ONLY, no logic
├── domain/                                # framework-free; sole mutation path
│   ├── aggregates/<name>.aggregate.ts      # root extends AggregateRoot<Id>; private props/ctor
│   ├── aggregates/<name>.invariants.ts     # invariantRegistry.register('<name>.create'…), side-effect
│   ├── entities/                           # child entities (e.g. PurchaseOrderLine) + invariants
│   ├── value-objects/<x>.vo.ts            # extends ValueObject<T>; static create() normalizes
│   ├── value-objects/<x>.invariants.ts     # invariantRegistry.register('<vo>.create'…), side-effect
│   ├── value-objects/<name>-id.vo.ts       # generate() / fromString()
│   ├── events/<name>.<past-verb>.event.ts  # extends DomainEvent, typed readonly props
│   ├── policies/<name>.policy.ts           # policyRegistry.register — reads EXTERNAL data, not own state
│   ├── factories/<name>.factory.ts         # SOLE construction path; side-effect-imports invariants/policies
│   ├── repositories/<name>-command.repository.ts  # ABSTRACT command port, domain types only
│   └── types/<name>.types.ts + <name>.enum.ts     # Props / CreateInput / QueryRecord / status enum
├── application/
│   ├── usecases/<verb>-<name>.usecase.ts  # ONE class per file (CreateProductUseCase); see §4
│   ├── queries/<name>.query.ts            # ABSTRACT query port → returns plain QueryRecord[]
│   ├── outbound-ports/                    # ports THIS module consumes (company-config, numbering,
│   │                                       # cross-module query ports, e.g. PurchasableProductPort)
│   ├── integrations/publishes/<name>.integration-port.ts  # abstract send(event, id)
│   ├── integrations/publishes/<name>.<event>.integration-event.ts  # JSON-safe wire shape per event
│   ├── integrations/listeners/            # ONLY place broker decorators allowed
│   │                                      # *.rabbitmq|*.kafka|*.sqs|*.event-emitter.listener-event.ts
│   └── facades/<name>-for-<consumer>.facade.ts  # implements OWN public port, delegates to query use case
├── public/                                # THE only cross-module surface
│   ├── contracts/<name>-for-<consumer>.contract.ts  # plain interfaces, NO domain classes
│   ├── ports/<name>-for-<consumer>.port.ts          # abstract class port this module EXPORTS
│   └── index.ts                           # re-exports contracts + ports ONLY
├── infrastructure/
│   ├── persistence/prisma-<name>-command.repository.ts  # extends domain port; TransactionHost only
│   ├── persistence/prisma-<name>-query.repository.ts   # implements query port; PrismaReadPort (replica)
│   ├── persistence/prisma-<name>.mapper.ts              # toDomain (via instantiate) / toRow / toRecord
│   ├── adapters/platform/                 # implements module-local ports via @platform ports
│   │                                      # outbox.adapter.ts, company-config.adapter.ts, numbering.adapter.ts
│   └── adapters/module/<other>-<name>.adapter.ts  # ONLY when consuming another public port;
│                                                  # injects producer public port, implements local outbound port
└── presentation/http/
    ├── <name>.controller.ts               # thin: validate DTO → call use case → { data, message }
    ├── requests/<verb>-<name>.request.dto.ts  # ONE DTO per file (createZodDto + exported schema)
    └── responses/<name>.<web|mobile>.response.dto.ts + id.response.dto.ts
```

`prisma/schema/<context>/<module>.prisma` is the table contract (header comment,
`@@map` snake table, quoted `@map` columns, `Decimal(18,2)` money as JSON
`{minorUnits, amount, currency}`, `version` column). Migration SQL is hand-written
in `prisma/migrations/<ts>_<name>/migration.sql`, then `npx prisma generate`.

## 4. Patterns per layer

### 4.1 Domain — aggregate is the sole mutation path

- **Value object** (`sku.vo.ts`): `extends ValueObject<{value}>`, private ctor,
  `static create()` normalizes (`trim().toUpperCase()` / `toLowerCase()`).
  Validation lives in sibling `<x>.invariants.ts` via
  `invariantRegistry.register('<vo>.create', …)`.
- **Aggregate** (`product.aggregate.ts`): `extends AggregateRoot<Id>`, private
  props + private ctor, `static instantiate()` reserved for factory/mapper.
  Mutation methods (`update`, `changePrice`, `activate`, …) enforce invariants then
  `this.addEvent(new XxxEvent(…))`. Status machines live here, e.g.
  `ACTIVE | INACTIVE | DISCONTINUED` (no outgoing transitions from `DISCONTINUED`);
  `PurchaseOrder`: `DRAFT → SUBMITTED → APPROVED → COMPLETED` with
  `REJECTED`/`CANCELLED` branches.
- **Factory** (`product.factory.ts`): sole sanctioned build path —
  `invariantRegistry.enforce('product.create', …)` → `X.instantiate(Id.generate(), …)`
  → `addEvent(new XCreated(…))`. Must side-effect-import all
  `*.invariants.ts` + policy files so registries are populated.
- **Events** (`domain/events/`): `class ProductCreated extends DomainEvent` with
  `eventId/occurredAt/version + correlationId/causationId/headers`. The aggregate
  raises it and the integration port appends it to the outbox inside the
  transaction; the in-process listener receives the canonical envelope and reads
  the business payload from `message.payload` — no rehydrator.
- **Policies** (`policies/`): `policyRegistry.register('<scope>.<rule>', …)` —
  cross-cutting rules reading external data (e.g. `product.reactivation`,
  `vendor.orderability`, `purchase-order.approval` with company-config threshold).
  Rule classes never cross-import aggregates.

Shared primitives (`business/shared-business/`): `AggregateRoot` (`version` +
`addEvent/pullEvents`), `Entity`, `ValueObject` (equals by props), `DomainEvent`,
`DomainFactory`, `Money` (minor-units integer math), `invariantRegistry`,
`policyRegistry`.

### 4.2 Application — command vs query, ports everywhere

**Command use case — exact 6-step flow** (`create-product.usecase.ts`):

```ts
@Injectable()
export class CreateXUseCase {
  constructor(
    private readonly xs: XCommandRepository,
    private readonly integration: XIntegrationPort,
    private readonly companyConfig: CompanyConfigPort,
  ) {}
  @Transactional()
  async execute(input: CreateXRequest): Promise<XId> {
    const company = await this.companyConfig.getCompanyConfig(); // 1 context
    const x = XFactory.create({ ... });                          // 2 build + invariants
    const dup = await this.xs.findByUniq(x.uniq);                // 3 pre-check → ConflictException
    if (dup) throw new ConflictException(...);
    await this.xs.save(x);                                       // 4 persist (same tx)
    for (const ev of x.pullEvents())                             // 5 drain
      await this.integration.send(ev, x.id.toString());          //   → OUTBOX via port
    return x.id;                                                 // 6 return id VO
  }
}
```

- Commands: `@Injectable()` + `@Transactional()`, orchestrate module-local ports,
  cross-module calls via outbound ports, never publish to brokers directly.
- Queries: read-only, skip aggregate + outbox, go through `XQuery` port
  (`PrismaReadPort`/replica) returning `XQueryRecord`. No aggregate hydration.
- Controllers call use cases **directly** — no inbound-port / mediator layer.
- **Module-local outbound port** pattern (never import `@platform` in
  domain/usecases): declare abstract `CompanyConfigPort` in
  `application/outbound-ports/`, implement `CompanyConfigAdapter` in
  `infrastructure/adapters/platform/` forwarding the `@platform` token, bind with
  `useExisting`.
- **Integration port** pattern: abstract `send(event: DomainEvent, id: string)`;
  single implementation `OutboxAdapter` forwards to
  `OutboxWriterPort.append(event, '<AggregateType>', id)` inside the same tx.
- **Listeners** (`integrations/listeners/`): one class per transport per event;
  `@RabbitSubscribe({ exchange: 'erp.events', routingKey, queue })`,
  `@KafkaEvent('<Type>')`, `@SqsMessageHandler`, `@OnEvent('<ClassName>')`.
  Handler delegates to a use case / facade.

### 4.3 Public contract — cross-module reads

Producer owns `public/` (plain `XReference` contract + abstract port, re-exported
from `public/index.ts`), implements it with a **facade** delegating to its own
query use case, and **exports the port** from its module.

Consumer owns an outbound port in `application/outbound-ports/` typed against the
producer's contract shape, binds an adapter in `infrastructure/adapters/module/`
that injects the producer's public port, and `imports` the producer module (only
to make the provider resolvable).

```ts
// consumer use case — direct injection of the outbound-port token
constructor(private readonly vendorQueryPort: OrderableVendorPort) {}
```

Current wiring: `PurchaseOrder → PurchasableProductPort → ProductModule`,
`PurchaseOrder → OrderableVendorPort → VendorModule`,
`GoodReceiptNote → PurchaseOrderPort → PurchaseOrderModule`. Business rules on
these paths: only `ACTIVE` products are purchasable (`findPurchasableById`), only
`ACTIVE` vendors orderable (`findOrderableById`). Write triggers use Rabbit
listeners instead (e.g. GRN on `PurchaseOrderApproved`).

### 4.4 Infrastructure — persistence + adapters stay with the module

- `prisma-<name>.mapper.ts`: `toDomain(row)` via `<Name>.instantiate`,
  `toRow(agg)`, `toRecord(row)`. Money via `Money.fromDecimal` / JSON helpers.
- Command repo: injects `TransactionHost<TransactionalAdapterPrisma>` → joins the
  use case `@Transactional()` boundary (aggregate change + outbox row commit atomically).
- Query repo: injects `PrismaReadPort` (replica; falls back to write pool).
- `adapters/platform/`: `outbox.adapter.ts`, `company-config.adapter.ts`,
  `numbering.adapter.ts` (prefer platform `NumberingPort` for new document numbers).
- `adapters/module/`: consumer-side adapters only (see §4.3).

### 4.5 Presentation — thin controller, Zod DTOs, device-aware responses

- Requests: `presentation/http/requests/*.request.dto.ts`, **one DTO per file**,
  `createZodDto(z.object({…}))` + exported schema; global `AppValidationPipe` maps
  failures to `422 VALIDATE_ERROR`.
- Responses: per-endpoint `web` (full) + `mobile` (minimal) DTOs selected by
  `x-device-type` via `@DeviceResponse(MobileDto, WebDto)` + `DeviceResponseInterceptor`.
- Controller returns `{ data, message }` (`ApiResponse<T>`); global
  `ResponseInterceptor` wraps to `{ status, statusCode, data, message }`, global
  `HttpExceptionsFilter` maps `HttpException` / `statusCode`-tagged errors.
  Controller never reads `RequestContextPort`; the use case resolves tenant/actor.

### 4.6 Module file — bindings/exports only

```ts
@Module({
  imports: [PlatformModule, ProductModule, VendorModule], // + producer modules only if consuming
  controllers: [XController],
  providers: [
    CreateXUseCase,
    ListXsUseCase /* … */,
    PrismaXCommandRepository,
    { provide: XCommandRepository, useExisting: PrismaXCommandRepository },
    PrismaXQueryRepository,
    { provide: XQuery, useExisting: PrismaXQueryRepository },
    OutboxAdapter,
    { provide: XIntegrationPort, useExisting: OutboxAdapter },
    CompanyConfigAdapter,
    { provide: CompanyConfigPort, useExisting: CompanyConfigAdapter },
    // pure BatchOperationHandler / ImportHandler adapters stay provider-only here;
    // registration into platform registries happens in src/bootstrap/configure-*.ts
  ],
  exports: [XForYPort], // ONLY public ports
})
export class XModule {}
```

No logic, no `@Global()`, no lifecycle hooks in business modules. Opt-in
platform features (`BatchOperationHandler`, `ImportHandler`,
`ScheduledJobFireHandler`, `FieldResolver`) are pure port data here; the
composition root (`src/bootstrap/configure-batch-operations.ts`,
`configure-imports.ts`, …) registers the handler instance into the platform
registry after instantiation.

## 5. Outbox, events, messaging (what the use case triggers)

1. Use case appends each drained domain event via `IntegrationPort → OutboxAdapter
→ OutboxWriterPort.append` — same DB tx as the aggregate write (tenant + trace
   headers stamped from `RequestContextPort`).
2. `OutboxScheduler` (poll `OUTBOX_POLL_INTERVAL_MS`) → `OutboxPublisher`
   claims with `UPDATE … FOR UPDATE SKIP LOCKED` (lease `claimedAt`, `attempts` +
   `nextRetryAt` backoff), publishes per-aggregate FIFO, re-dispatches in-process
   with stable envelope identities (canonical `OutboxEnvelope`).
3. The envelope's `broker` field decides the transport (default `rabbitmq`)
   (default `rabbitmq` topic exchange `erp.events`; adding Kafka/SQS listener ⇒ add target here).
4. Statuses `PENDING → PUBLISHING → PUBLISHED | FAILED | DEAD_LETTER`; lease-expiry
   reconciler + hourly cleanup; at-least-once delivery, consumers dedupe on stable
   `event-id`.

## 6. Creating a new business module (build order + acceptance)

Build order (full templates in `docs/BUSINESS-MODULE-GUIDE.md`):

1. Schema first: `prisma/schema/<ctx>/<name>.prisma` + hand-written
   `prisma/migrations/<ts>_<name>/migration.sql`; `npx prisma generate`.
2. Domain leaf-to-root: types → enums → VOs (+id) → invariants → events
   → policies → aggregate → factory (side-effect-import invariants/policies).
3. Domain command-repository port (abstract) + application query port.
4. Use cases (command 6-step flow; query via query port).
5. Infrastructure: mapper, command repo, query repo, platform adapters (+ module-local ports).
6. `public/` contract + port + `index.ts` (if others read you) + facade delegating to query use case.
7. Presentation: request DTOs, web/mobile response DTOs, thin controller.
8. Listeners only if consuming broker events (+ `FAN_OUT_EVENTS` entry for Kafka/SQS).
9. `<name>.module.ts` bindings as §4.6; wire into `<ctx>.module.ts`; add
   `<ctx>/<name>` to `businessModules` in `eslint.config.mjs`.
10. Bridged opt-ins: append one row to the relevant
    `src/bootstrap/configure-<feature>.ts` table (e.g. `BATCH_OPERATION_AGGREGATES`).
11. Tests + docs: aggregate spec + use-case spec (fakes, `initNoopTransactionHost()`);
    `npx tsc --noEmit`, `npm run lint:check`, `npm test`, `npm run docs:di`.

Acceptance: zero `@nestjs/*` in `domain/**`; aggregate-only mutation via factory;
command path `@Transactional` + repo + outbox-append (no direct publish); reads on
query port + replica; every persisted event rides the outbox (payload verbatim); cross-module only via
`public/` + outbound port; lint + types + unit tests green.

Known gaps to not copy blindly (see guide §6): business tables not yet
tenant-scoped (single shared instance by design; platform tables are); `version`
columns persisted but not yet CAS-guarded in business `save/update` — gate updates
on `(id, version)` when adding the migration.
