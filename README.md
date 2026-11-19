# ERP Boilerplate

A production-oriented ERP backend foundation using **NestJS 11 + TypeScript (strict) +
PostgreSQL (Prisma 7)**, structured as a **DDD / Hexagonal (Ports & Adapters) modular monolith**
with a **transactional outbox**, **domain events**, **RBAC/ABAC authorization**, **multi-tenancy**,
and a strict **business ↔ infrastructure boundary** enforced by ESLint.

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — architecture, layers, dependency rules,
  module anatomy, tenancy, auth/RBAC/ABAC, outbox/events/messaging, data model, verification
- [`docs/platform-migration-plan.md`](docs/platform-migration-plan.md) — phase plan, module
  ledger and remaining platform work.
- [`docs/platform-standard.md`](docs/platform-standard.md) — canonical rules for every
  `src/platform/**` module: inbound/outbound anatomy, ports, exceptions, table contract, lock and saga persistence
- [`docs/saga.md`](docs/saga.md) — how the saga works: the three modules, definition
  format, lifecycle (start → advance → worker → compensation → completion), state
  machines, configuration knobs, and how to wire a business module into it.
- [`docs/Erp Backend Folder Structure.xlsx`](docs/Erp Backend Folder Structure.xlsx) — complete project structure and file organization reference
- [`docs/eslint-formatting-typescript-rules.md`](docs/eslint-formatting-typescript-rules.md) — complete ESLint, Prettier and TypeScript rule reference, including enforced architecture boundaries

## Quick start

```bash
cp .env.example .env
docker compose up -d          # PostgreSQL, Redis, RabbitMQ
npm install                   # postinstall runs prisma generate
npm run db:migrate:deploy     # apply committed migrations (prisma/migrations)
npm run db:migrate            # create a migration after editing prisma/schema
npm run db:seed               # dev data (companies, saga definitions, demo aggregates)
npm run start:dev             # API + Swagger on http://localhost:4000/api/v1
```

Database changes follow one rule: **the schema authoring happens in
`prisma/schema/<context>/*.prisma`, the truth of what a database runs is
`prisma/migrations`**. Edit → `npm run db:migrate` → commit both. `npm run db:push`
survives only for throwaway local databases; CI applies migrations with
`db:migrate:deploy` and fails if the migrated database drifts from the schema.
A database that was created with an older `db push` baseline is adopted once with
`npm run db:migrate:baseline` (marks `20251118000000_init` as already applied).

- REST API: `http://localhost:4000/api/v1`
- Swagger: `http://localhost:4000/api/docs`
- RabbitMQ UI: `http://localhost:15672` (guest/guest)

## Example API flow

```bash
curl -X POST http://localhost:4000/api/v1/products \
  -H "Content-Type: application/json" \
  -d '{"sku":"SKU-100","name":"Wireless Mouse","unitPrice":19.99,"currency":"USD"}'

curl -X POST http://localhost:4000/api/v1/vendors \
  -H "Content-Type: application/json" \
  -d '{"code":"VEN-100","name":"Acme Supplies","email":"billing@acme.com"}'

curl -X POST http://localhost:4000/api/v1/purchase-orders \
  -H "Content-Type: application/json" -d '{"vendorId":"<vendor-id>"}'
```

## Verification battery

```bash
npx tsc --noEmit -p tsconfig.json
npm run lint:check
npm run format:check
npm run docs:di
npm run build
```

See [`docs/architecture.md`](docs/architecture.md) for the full verification battery including
the DI smoke test.
