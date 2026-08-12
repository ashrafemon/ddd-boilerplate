# ERP Boilerplate — NestJS Event-Driven Modular Monolith

A production-oriented ERP backend foundation using **NestJS 11 + TypeScript + PostgreSQL
(Prisma 7)**, structured as a **DDD / Hexagonal (Ports & Adapters) modular monolith** with a
**transactional outbox**, **domain events**, a **CQRS-style command/query split**, a
**routing policy for RabbitMQ / Kafka / SQS**, in-app consumers, schedulers, and a strict
**business ↔ infrastructure boundary** enforced by ESLint.

Documentation:

- [ARCHITECTURE.md](./ARCHITECTURE.md) — design, layers, outbox, events, data model
- [DEVELOPER.md](./DEVELOPER.md) — setup, conventions, adding modules, testing
- [MAINTAINER.md](./MAINTAINER.md) — deployments, migrations, ops, releases

---

## Quick Start

```bash
cp .env.example .env
docker compose up -d          # PostgreSQL, Redis, RabbitMQ, Kafka
npm install                   # also runs prisma generate (postinstall)
npx prisma migrate dev        # create + apply the initial migration
npm run db:seed               # sample products & vendors
npm run start:dev             # API + Swagger
```

Then:

- REST API: <http://localhost:4000/api/v1>
- Swagger: <http://localhost:4000/api/docs>
- RabbitMQ UI: <http://localhost:15672> (guest/guest)

---

## Example API Flow

```bash
# Create a product
curl -X POST http://localhost:4000/api/v1/products \
  -H "Content-Type: application/json" \
  -d '{"sku":"SKU-100","name":"Wireless Mouse","unitPrice":19.99,"currency":"USD"}'

# Create a vendor
curl -X POST http://localhost:4000/api/v1/vendors \
  -H "Content-Type: application/json" \
  -d '{"code":"VEN-100","name":"Acme Supplies","email":"billing@acme.com"}'

# Create a purchase order (vendorId + productId from the responses above)
curl -X POST http://localhost:4000/api/v1/purchase-orders \
  -H "Content-Type: application/json" -d '{"vendorId":"<vendor-id>"}'

# Add a line
curl -X POST http://localhost:4000/api/v1/purchase-orders/<po-id>/lines \
  -H "Content-Type: application/json" \
  -d '{"productId":"<product-id>","quantity":3,"unitPrice":19.99}'

# Submit — publishes PurchaseOrderSubmitted; the approval policy then auto-approves
# orders under the company's autoApproveThreshold (higher orders await manual approval)
curl -X POST http://localhost:4000/api/v1/purchase-orders/<po-id>/submit
```

Every state change writes the resulting domain events into the **transactional outbox** (in
the same DB transaction) and the scheduler publishes them to **RabbitMQ** (and optionally
**Kafka** / **SQS** via `MessageRoutingPolicy`), re-dispatching them in-process for local
reactions.

---

## Project Layout

```text
src/
├── config/            # .env-driven typed configuration
├── shared-kernel/     # NestJS technical concerns + platform ports (filters, interceptors, pipes)
├── bootstrap/         # app bootstrap (security, cors, http, swagger, shutdown, sentry)
├── infrastructure/    # cross-cutting adapters: Prisma, Redis, RabbitMQ, Kafka, SQS, SES, S3, Sentry
├── platform/          # outbox, event bus, routing policy, audit, numbering, notification, configuration
└── business/
    ├── shared-business/   # domain/application/port primitives (framework-independent)
    ├── catalog/product/       # Product aggregate
    ├── supplier/vendor/       # Vendor aggregate
    └── procurement/purchase/  # PurchaseOrder aggregate (uses vendor/product outbound ports)
```

Each aggregate module keeps its own `domain`, `application` (use cases, cross-module
adapters, consumers), `infrastructure/persistence` (Prisma repos + mappers), and
`presentation/http` (controllers + DTOs). Cross-module calls go through outbound ports
resolved via the Nest container — modules never import each other.

---

## Scripts

| Command | Purpose |
|---|---|
| `npm run start:dev` | watch mode dev server |
| `npm run build` | compile to `dist/` |
| `npm run lint` | ESLint + architecture import restrictions (`--fix`) |
| `npm run lint:check` | ESLint + architecture checks (read-only) |
| `npm test` | unit tests (aggregates, use cases with fakes) |
| `npm run test:e2e` | e2e smoke (requires `docker compose up -d`) |
| `npx prisma migrate dev` | create/apply migration + regenerate client |
| `npm run db:deploy` | apply migrations in staging/production |
| `npm run db:seed` | seed products/vendors |
| `npm run prisma:studio` | Prisma Studio UI |
