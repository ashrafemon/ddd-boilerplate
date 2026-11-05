# ERP Boilerplate — Service Module Development

This document provides clear, practical guidelines for designing, developing, extending, and
maintaining service modules within the project, using AI models and agents where appropriate.

## Overview

A "service module" in this project can be either:

- **Business module** — owns an aggregate (Vendor, Product, PurchaseOrder, GRN, Invoice)
- **Platform service** — provides a cross-cutting capability (Outbox, Context, Authorization,
  Configuration, Numbering, etc.)

Both follow strict port/adapter conventions and are developed using the same verification
battery.

---

## Part 1: Developing a Business Module

### Step 1: Plan the module

Before writing code, define:

| Question | Answer |
|----------|--------|
| Which bounded context? | `party`, `procurement`, or `sales` |
| What is the aggregate root? | e.g., `Product`, `PurchaseOrder` |
| What is the natural key? | Unique within company (e.g., `sku`, `orderNumber`) |
| What is the status machine? | e.g., `ACTIVE → INACTIVE → DISCONTINUED` |
| Which cross-module ports does it consume? | e.g., `PurchasableProductPort`, `OrderableVendorPort` |
| Which public port does it export? | e.g., `ProductForPurchasePort` |

### Step 2: Copy the reference layout

Use `src/business/procurement/product` as the layout reference:

```
business/<context>/<module>/
├── domain/
│   ├── aggregates/<name>.aggregate.ts
│   ├── aggregates/<name>.invariants.ts
│   ├── entities/
│   ├── value-objects/
│   ├── events/
│   ├── policies/
│   ├── factories/<name>.factory.ts
│   ├── repositories/<name>-command.repository.ts
│   └── types/
├── application/
│   ├── usecases/<verb>-<noun>.usecase.ts
│   ├── queries/<name>.query.ts
│   ├── facades/<name>-for-<consumer>.facade.ts
│   ├── outbound-ports/
│   └── integrations/
│       ├── publishes/<name>.publisher-port.ts
│       └── listeners/
├── infrastructure/
│   ├── persistence/prisma/prisma-<name>-.repository.ts
│   └── adapters/
│       ├── platform/
│       └── module/
├── presentation/http/
│   ├── <name>.controller.ts
│   ├── requests/
│   └── responses/
├── public/
│   ├── contracts/
│   ├── ports/
│   └── index.ts
└── <module>.module.ts
```

### Step 3: Define domain types

Create `domain/types/<name>.types.ts` with:

- Enums for status
- Request types for each use case input
- Props types for factory input

### Step 4: Define value objects

Create `domain/value-objects/` with typed VOs (e.g., `ProductId`, `Sku`, `Money`).

### Step 5: Create invariants and policies

- `domain/aggregates/<name>.invariants.ts` — register invariants in `invariantRegistry`
- `domain/policies/*.policy.ts` — register policies in `policyRegistry`

### Step 6: Create the factory

`domain/factories/<name>.factory.ts` — the only sanctioned build path. Register
invariants/policies as side-effect imports.

### Step 7: Create the aggregate

`domain/aggregates/<name>.aggregate.ts` — extends `AggregateRoot<ID>`, exposes domain
methods that call `this.addEvent(event)`.

### Step 8: Create repository port and implementation

- `domain/repositories/<name>-command.repository.ts` — abstract class = DI token
- `infrastructure/persistence/prisma/prisma-<name>-command.repository.ts` — Prisma impl

### Step 9: Create use cases

One file per use case: `application/usecases/<verb>-<noun>.usecase.ts`. Each command use
case:

1. Reads context from `RequestContextPort` (CLS).
2. Calls `AbacPort.evaluate()` before business steps.
3. Orchestrates factory → aggregate → repository port → outbox.

### Step 10: Create controller and DTOs

- `presentation/http/<name>.controller.ts` — thin, calls use cases directly
- `presentation/http/requests/*.request.dto.ts` — Zod via `createZodDto`
- `presentation/http/responses/*.response.dto.ts` — web/mobile Zod response DTOs

### Step 11: Create public contracts and ports

- `public/contracts/` — plain reference shapes
- `public/ports/` — abstract-class port exported to consumers
- `public/index.ts` — re-exports

### Step 12: Create module

`<module>.module.ts` — NestJS composition root with bindings/exports only.

### Step 13: Register in BusinessModule

Add the module to `src/business/business.module.ts` imports.

### Step 14: Verify

Run the full verification battery after each step.

---

## Part 2: Developing a Platform Service

### Step 1: Plan the service

Define:

| Question | Answer |
|----------|--------|
| What capability does it provide? | e.g., outbox, locking, idempotency |
| What port(s) does it expose? | abstract classes as DI tokens |
| What infrastructure client does it wrap? | Prisma, Redis, RabbitMQ, etc. |
| Is it tenant-scoped? | `tenantId String?` on owned tables |
| Does it have background workers/crons? | scheduler, reconciler, cleanup |

### Step 2: Copy the reference layout

```
platform/<service>/
├── README.md                     REQUIRED — purpose, API, layout, who-calls/how, data/config, tenancy, rules
├── <service>.module.ts           bindings + exports only (not @Global)
├── ports/                        abstract classes = DI tokens
├── usecases/                     one class per capability; @Transactional at boundary
├── repositories/                 Prisma data access (TransactionHost)
├── adapters/                     queue/broker/cache I/O adapters
├── http/requests/*.request.dto.ts ONE DTO per file
├── <name>.ticker.ts              crons for crashed executions
└── __testing__/                  in-memory port fakes
```

### Step 3: Define ports

Create `ports/` with abstract classes used as DI tokens.

### Step 4: Create the module

`<service>.module.ts` — bindings and exports only, no logic.

### Step 5: Register in PlatformModule

Add to `src/platform/platform.module.ts` imports and exports.

### Step 6: Create service README

Required sections:

| Section | Content |
|---------|---------|
| What it does | Purpose and scope |
| Public API | Ports, methods, signatures |
| Layout | File/folder structure |
| Who calls it / how | Consumers and invocation patterns |
| Data & config | Tables, config keys, defaults |
| Tenancy behaviour | Tenant scoping, fail-closed rules |
| Rules & gotchas | Invariants, edge cases |

### Step 7: Verify

Run the full verification battery.

---

## Part 3: Using AI Agents for Module Development

### How to prompt an AI agent

Be specific about:

1. **What to build** — feature description, aggregate name, use cases
2. **Which files to create/modify** — full paths
3. **Architecture constraints** — port rules, no `@infrastructure/**` imports, no `@nestjs/*` in domain
4. **Verification requirements** — run `tsc`, `lint:check`, `format:check`, `docs:di`, `build`, DI smoke

### Example prompt

> "Create a new business module `sales/order` under `src/business/sales/`. The aggregate is
> `Order` with status DRAFT → SUBMITTED → APPROVED → COMPLETED. Natural key is
> `orderNumber`, unique per company. Create: domain aggregate, factory, invariants,
 * policies, command repository port, create-order use case, query port, controller,
> DTOs, public port, and module bindings. Follow all conventions in AGENTS.md.
> Run verification after each phase."

### AI agent workflow for module development

```
1. Plan → document files to create/modify
2. Domain layer → types, VOs, invariants, policies, aggregate, factory
3. Persistence → repository port + Prisma implementation
4. Application → use cases (with CLS + ABAC), queries, facades
5. Integration → publisher port, integration events
6. Presentation → controller, request/response DTOs
7. Public → contracts, ports, index
8. Module → bindings, exports, BusinessModule registration
9. Verify → full verification battery
```

### Common AI agent mistakes to avoid

| Mistake | Correction |
|---------|-----------|
| Injecting `CompanyConfigPort` directly into a use case | Read from `RequestContextPort` (CLS) instead |
| Injecting `AuthenticationPort` into a use case | Not allowed; use `RequestContextPort` |
| Calling `AbacPort` after business steps | Call before business steps |
| Importing `@infrastructure/**` from business module | Use `@platform` ports or `public/` contracts |
| Platform importing `@business/**` | Use structural `OutboxEvent` interface only |
| Adding comments to code | No comments unless asked |
| Editing `src/generated/**` | Never edit generated files |
| Committing without being asked | Only commit when explicitly requested |

---

## Part 4: Maintenance Guidelines

### Extending an existing module

1. Read the module's existing code to understand patterns.
2. Add new use cases following `<verb>-<noun>.usecase.ts` naming.
3. Add new DTOs following one-DTO-per-file convention.
4. Update module bindings if new providers are needed.
5. Run verification battery.

### Refactoring

- Preserve port/adapter boundaries.
- Do not change public contracts without explicit owner approval.
- Run verification battery after each refactoring step.
- Update `docs/DI-WIRING.md` via `npm run docs:di`.

### Adding new platform services

1. Follow `docs/platform-services.md` step-by-step.
2. Create service README with all required sections.
3. Register in `PlatformModule`.
4. Bridge business opt-in registries via `src/bootstrap/configure-*.ts` if needed.
5. Run verification battery.

### Tenancy changes

- All new business tables must carry `tenantId`/`companyId`.
- All reads/writes must filter on `tenantId`/`companyId`.
- Foreign row access returns 404, never 403.
- Natural keys unique within company, not globally.
