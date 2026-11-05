# ERP Boilerplate — Business Modules

Business modules own their aggregates, domain logic, and persistence through port/adapter
boundaries. This document describes the anatomy, patterns, and conventions for every business
module in the system.

## Module anatomy

Every aggregate module follows the same shape (shown for `procurement/product`):

```
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

## Aggregate root pattern

The aggregate root is the **sole mutation path**:

1. **Factory** (`domain/factories/<name>.factory.ts`) — the only sanctioned build path.
   Registers invariants/policies as side-effect imports.
2. **Aggregate** (`domain/aggregates/<name>.aggregate.ts`) — extends `AggregateRoot<ID>`,
   tracks version, exposes `addEvent()`/`pullEvents()` for domain events.
3. **Invariants** (`domain/aggregates/<name>.invariants.ts`) — registered in
   `invariantRegistry`, enforced via `invariantRegistry.enforce('key', data)`.
4. **Policies** (`domain/policies/*.policy.ts`) — registered in `policyRegistry`,
   evaluated via `policyRegistry.evaluate('key', data)` or enforced via `enforce()`.

## Use case pattern

### Command use cases

Command use cases are `@Injectable()` classes with an `execute(input)` method annotated
`@Transactional()` (`@nestjs-cls/transactional`). They:

1. Read context from `RequestContextPort` (CLS) — **never inject `AuthenticationPort`**
   or `CompanyConfigPort` directly.
2. Call `AbacPort.evaluate()` with the CLS-derived context before business steps.
3. Orchestrate module-local ports, make cross-module calls through outbound ports.
4. Build/call the aggregate via its factory.
5. Persist through the **command repository port**.
6. Drain `pullEvents()` and append them to the **integration port** (which writes the
   outbox in the same transaction).

### Query use cases

Query use cases are read-only. They skip the aggregate and the outbox entirely and go
through the **query repository port** bound to a Prisma implementation using
`PrismaReadPort` (replica connection).

### Controller pattern

Controllers call use cases **directly** — there is no inbound-port / mediator layer.
Controllers are thin: inject use cases, call `execute`, return `{data, message}`.

## Cross-module communication

Modules exchange queries through contracts:

1. **Public port (producer-owned)** — `business/<context>/<module>/public/`:
   a plain `*Reference` contract + an abstract-class port, re-exported from
   `public/index.ts`. The producer implements it with a **facade** that delegates to
   one of its own query use cases, and **exports the port**.

2. **Outbound port (consumer-owned)** — the consuming module declares the port it needs
   in `application/outbound-ports/` and binds an adapter in
   `infrastructure/adapters/module/` that injects the producer's public port.

3. **Direct injection** — command use cases inject the outbound port token in their
   constructor.

Current wiring:

```text
PurchaseOrder ──PurchasableProductPort──▶ ProductModule: ProductForPurchaseFacade
              ──OrderableVendorPort────▶ VendorModule:   VendorForPurchaseFacade
GoodReceiptNote ──PurchaseOrderPort─────▶ PurchaseOrderModule: PurchaseOrderForGrnFacade
```

## Aggregate reference

| Context | Module | Aggregate | Natural key (unique per company) |
|---------|--------|-----------|----------------------------------|
| `party` | `vendor` | Vendor | `code` |
| `procurement` | `product` | Product | `sku` |
| `procurement` | `purchase-order` | PurchaseOrder | `orderNumber` |
| `procurement` | `good-receipt-note` | GoodReceiptNote | `grnNumber` |
| `sales` | `invoice` | Invoice | `invoiceNo` |

## Tenancy

Every business table carries `tenantId`/`companyId`, stamped from the request context on
create and filtered on every read and write:

- A foreign row is **404**, never 403 — no existence leak.
- A document's natural key is unique **within its company**, not globally.
- Two companies each have a `PO-00000001` — the numbering series is company-scoped.

## Rules

See `rules/architecture-rules.md` for hard rules enforced by ESLint architecture boundaries.

See `rules/coding-standards.md` for TypeScript/NestJS naming and code conventions.
