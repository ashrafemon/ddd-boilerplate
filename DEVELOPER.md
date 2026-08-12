# Developer Guide

How to set up, work in, and extend this codebase day-to-day.

- Architecture & design: [ARCHITECTURE.md](./ARCHITECTURE.md)
- Operations, deploys & maintenance: [MAINTAINER.md](./MAINTAINER.md)

---

## 1. Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | >= 20.10 | `.nvmrc` pinned |
| npm | >= 10 | |
| Docker + Compose | any recent | for PostgreSQL, Redis, RabbitMQ, Kafka |
| PostgreSQL | via Docker | target 16 |

First run:

```bash
cp .env.example .env
docker compose up -d        # postgres, redis, rabbitmq, kafka
npm install                 # runs prisma generate via postinstall
npx prisma migrate dev      # create + apply migrations, regenerate client
npm run db:seed             # sample products & vendors
npm run start:dev
```

Verify:

- REST API: `http://localhost:4000/api/v1`
- Swagger: `http://localhost:4000/api/docs`
- RabbitMQ UI: `http://localhost:15672` (guest/guest)
- Outbox rows: `npx prisma studio`

---

## 2. Environment Files

The config module loads, in order: `.env.{NODE_ENV}.local`, `.env.{NODE_ENV}`, `.env`.

`NODE_ENV` defaults to `development`, so `.env.development.local` → `.env.development` → `.env`.

Every variable is read **only** in `src/config/*.ts`. Never access `process.env` elsewhere.

The `.env` file is git-ignored. `SENTRY_DSN`, AWS keys, JWT secrets and `SQS_URL` can be left
empty in development — the adapters are lazy/no-ops until configured (see
[MAINTAINER.md §5](./MAINTAINER.md#5-environment-variables)).

---

## 3. Day-to-Day Commands

| Command | What it does |
|---|---|
| `npm run start:dev` | watch-mode dev server |
| `npm run build` | `nest build` → `dist/` |
| `npm run start:prod` | run compiled `dist/` |
| `npm run lint` | ESLint + architecture rules with `--fix` |
| `npm run lint:check` | ESLint, read-only (use in CI / before commit) |
| `npm run format` | prettier write |
| `npm run format:check` | prettier check |
| `npm test` | jest unit tests |
| `npm run test:watch` | jest watch |
| `npm run test:cov` | coverage report |
| `npm run test:e2e` | e2e smoke (needs docker services up) |
| `npm run db:generate` | `prisma generate` |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:deploy` | `prisma migrate deploy` (prod) |
| `npm run db:seed` | seed products/vendors |
| `npm run prisma:studio` | Prisma Studio |

Because lint runs with `--fix`, get into the habit of `npm run lint:check` before committing
and `npm test` after making domain/use-case changes.

---

## 4. Code Conventions

### Naming

| Artifact | Convention | Example |
|---|---|---|
| Aggregate class | PascalCase | `Product` |
| Value object | PascalCase + `.vo.ts` | `sku.vo.ts` → `Sku` |
| Domain error | PascalCase, `*.errors.ts` | `product.errors.ts` → `ProductErrors` |
| Domain event | PascalCase, `*.events.ts` | `ProductCreated` |
| Use case | file `kebab-case.usecase.ts` | `get-purchasable-product.usecase.ts` |
| Port file | `kebab-case.port.ts` | `product-command-repository.port.ts` |
| Port token | `UPPER_SNAKE` constant | `PRODUCT_COMMAND_REPOSITORY` |
| Repository impl | `prisma-<x>-command.repository.ts` | `prisma-product-command.repository.ts` |
| Controller | `<x>.controller.ts` | `product.controller.ts` |
| DTO request | `<x>.request.ts` (Presentation: request) | `product.request.ts` |
| Test | colocated `*.spec.ts` | `create-product.usecase.spec.ts` |

### Rules of thumb

1. **Domain never imports NestJS, Prisma, or brokers.** If you see `@nestjs/*`,
   `@prisma/*`, `prisma/generated/*`, `ioredis`, `kafkajs`, or `amqplib` outside
   `infrastructure/`, `config/`, `bootstrap/`, `platform/`, or business
   `application/consumers/` — that's a violation.
2. **Aggregates protect their own state.** No setters. `order.approve()`, never
   `order.status = 'APPROVED'`.
3. **Commands write through the command repository and append events to the outbox inside
   `@Transactional()`. Queries never write and never touch the outbox.**
4. **Cross-module calls go through outbound ports resolved with `MODULE_PORT_RESOLVER`.** Never
   import another module.
5. **DTO validation happens only at the `presentation` boundary.**
6. **Controllers are thin.** No business logic — call a use case, return
   `{ data, message }`.
7. **No `process.env` outside `src/config/`.**
8. **Comments:** explain *why*, not *what*. Public API docs in JSDoc where non-obvious.

### Formatting

Prettier + ESLint enforce style; `npm run lint` auto-fixes most issues. `.editorconfig`
applies to editors.

---

## 5. Working with the Outbox

Key mental model:

- A command use case runs in a transaction. It mutates the aggregate, saves it, then
  `pullEvents()` and appends each event to the outbox. **Committed together.**
- The **outbox scheduler** (not the use case) publishes: every 10s it claims a batch, routes
  each to brokers via `MessageRoutingPolicy`, re-dispatches the event in-process, and marks
  it published. Failed rows are retried every minute (up to `OUTBOX_MAX_ATTEMPTS`, default
  10), old published rows are cleaned every hour.
- If you need a **local reaction** to a domain event (e.g. an event-emitter consumer), it
  fires when the outbox publisher re-dispatches the event — which means it runs slightly
  later than the use case, in the publisher's context, after a successful publish.

### Adding a new event to a module

1. Define the event class in `domain/events/`.
2. Raise it from the aggregate (factory for creation events, aggregate methods for
   transitions).
3. Register a rehydrator at the bottom of the events file
   (`domainEventRegistry.register('ProductCreated', payload => ...)`, see
   `product.events.ts`) so the outbox can rebuild it for in-process dispatch.
4. If external consumers should receive it, make sure `MessageRoutingPolicy.resolve`
   routes `eventType` to the brokers you want.
5. Add consumers under `application/consumers/`.

### Monitoring the outbox

```bash
npx prisma studio                    # inspect outbox_messages
# status distribution
npx prisma db execute --stdin <<'SQL'
SELECT status, count(*) FROM outbox_messages GROUP BY status;
SQL
```

Persistent `FAILED` rows usually mean a broker is down or the routing policy references an
unconfigured broker. The scheduler retries automatically; logs show `Failed to publish
outbox message ...`.

---

## 6. Adding a New Business Module

Follow the 10-step checklist in [ARCHITECTURE.md §15](./ARCHITECTURE.md#15-creating-a-new-business-module).

Minimum viable module (example: `business/purchase/requisition`):

```text
business/purchase/requisition/
├── domain/
│   ├── entities/requisition.aggregate.ts
│   ├── value-objects/requisition-id.vo.ts
│   ├── events/requisition.events.ts
│   ├── invariants/requisition.invariants.ts
│   ├── policies/requisition.policy.ts
│   ├── factories/requisition.factory.ts
│   ├── errors/requisition.errors.ts
│   └── ports/requisition-command-repository.port.ts
│       ports/requisition-query-repository.port.ts
├── application/
│   ├── usecase/create-requisition.usecase.ts
│   ├── usecase/get-requisition.usecase.ts
│   └── ports/outbound/... (only if it needs other modules' data)
├── infrastructure/persistence/prisma-requisition.repository.ts (+ mapper)
├── presentation/http/controllers/requisition.controller.ts (+ request DTOs)
└── requisition.module.ts
```

Then:

- `npm run lint:check` — catches accidental `@nestjs/*` or infrastructure imports in domain.
- `npm test` — existing tests must stay green.
- Grep for the token resolution pattern in `purchase-order` use cases and mirror it if the
  module needs cross-aggregate data.

---

## 7. Adding a Platform Sub-System

Example: adding a `platform/billing`-style subsystem.

1. Create `src/platform/<name>/` with:
   - `README`-style port(s): `ports/<name>.port.ts` (interface + token).
   - A service implementing the port (may use `@infrastructure` clients and `@config`).
2. Register a `@Global` module (`<name>.module.ts`) providing `${TOKEN}`.
3. Import it in `PlatformModule` and re-export the token.
4. Business modules inject the token only.

Keep platform code free of business logic; it serves arbitrary aggregates.

---

## 8. Database & Prisma

- The schema is **split per aggregate** in `prisma/schema/` (`*.prisma` files aggregated by
  `schema.prisma`). Add/modify models in the matching file; small new models can live in
  `platform.prisma`.
- Prisma 7 uses the pg driver adapter and generates the client to `src/generated/prisma/`
  (do not hand-edit generated files).

### Migrations

```bash
npx prisma migrate dev --name <short_description>   # local
npx prisma migrate deploy                           # everywhere else / prod
npm run db:seed
```

Rules:

- One migration per logical change; keep `prisma/migrations/` tidy.
- Never edit an applied migration after pushing — create a new one.
- **Every model needs a mapper + repository wiring** in the owning module's
  `infrastructure/persistence/`, and Prisma models must map 1:1 to domain VO types.
- For read-heavy paths use the **query repository** + `PrismaReadService` (can point at a
  replica via `DATABASE_SLAVE_URL`).

Example of adding a column:

```prisma
// prisma/schema/vendor.prisma
model Vendor {
  ...
  taxId String?   // new column
}
```

```bash
npx prisma migrate dev --name add_tax_id_to_vendor
npx prisma generate
```

Then expose it in `VendorMapper`, the VO (if domain-worthy), the query/command repository
types, and DTOs.

---

## 9. Testing

### Unit tests (recommended approach)

Test aggregates and use cases with **fakes**, no external services:

- Aggregate specs drive state machines and invariants
  (`product.aggregate.spec.ts`, `vendor.aggregate.spec.ts`,
  `purchase-order.aggregate.spec.ts`).
- Use-case specs stub repository/outbox/config ports with plain objects implementing the
  port interface (`create-product.usecase.spec.ts`).

```bash
npm test
npm run test:cov
```

### E2E

`test/app.e2e-spec.ts` boots the app. Requires the docker services:

```bash
docker compose up -d
npm run test:e2e
```

### When to write which

| Change | Test |
|---|---|
| New invariant/state transition | aggregate spec |
| New/edited use case | use-case spec with fakes |
| New mapper field | mapper unit test |
| New cross-module port | use-case spec + e2e smoke |
| Controller/DTO change | e2e (or controller spec) |

---

## 10. Debugging

### Logs

Logging goes through `LoggingInterceptor` with `requestId`/`correlationId` in CLS. Set
`LOG_LEVEL` / use `DEBUG`-friendly logging by running with `NODE_ENV=development`
(verbose levels enabled). Sentry captures errors when `SENTRY_DSN` is set.

### Outbox debugging cheatsheet

| Symptom | Likely cause | Fix |
|---|---|---|
| Events stuck `PENDING` | Scheduler not running (only runs in-app) | confirm `npm run start:dev` healthy; check publish cron logging |
| Rows `FAILED` | Broker down / misconfigured | check RabbitMQ/Kafka; set correct env; scheduler retries |
| Event dispatched to wrong broker | `MessageRoutingPolicy` | update policy in `platform/events` |

### Common pitfalls

- **Instantiating repositories directly in tests** — always go through the port interface.
- **Importing a business module in another business module** — use outbound ports + resolver.
- **Reading `process.env` in services** — put it in `src/config/*.ts` instead.
- **Calling outbox/event bus from queries** — queries are read-only by contract.
- **Prisma client regeneration** — after schema changes always run
  `npx prisma generate`, otherwise TS errors on new fields.

---

## 11. Migration of an Existing Pattern

If you see code that predates these docs:

- Older branch layout had inbound ports (`ProductCommandPort`, `ProductQueryPort`) and a
  `shared-kernal` folder. The current convention is: **controllers call use cases directly**
  (no inbound port/facade), `shared-kernel` (correct spelling) holds technical concerns, and
  cross-module access goes through outbound ports + `ModulePortResolver`.
- Older outbox flow published events from use cases; the scheduler now owns all delivery
  (use cases only **append**).
- Trace these in `git log`/`git blame` if unsure.