# ERP Boilerplate

A production-oriented ERP backend foundation using **NestJS 11 + TypeScript (strict) +
PostgreSQL (Prisma 7)**, structured as a **DDD / Hexagonal (Ports & Adapters) modular monolith**
with a **transactional outbox**, **domain events**, **RBAC/ABAC authorization**, **multi-tenancy**,
and a strict **business ↔ infrastructure boundary** enforced by ESLint.

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — architecture, layers, dependency rules,
  module anatomy, tenancy, auth/RBAC/ABAC, outbox/events/messaging, data model, verification
- [`docs/Erp Backend Folder Structure.xlsx`](docs/Erp Backend Folder Structure.xlsx) — complete project structure and file organization reference

## Quick start

```bash
cp .env.example .env
docker compose up -d          # PostgreSQL, Redis, RabbitMQ, Kafka
npm install                   # postinstall runs prisma generate
npm run db:push               # create/sync database from prisma/schema
npm run start:dev             # API + Swagger on http://localhost:4000/api/v1
```

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
