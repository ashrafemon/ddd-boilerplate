# ERP Boilerplate — NestJS Modular Monolith

A production-oriented ERP backend foundation using **NestJS + TypeScript + PostgreSQL
(Prisma)**, structured as a **DDD / Hexagonal (Ports & Adapters) modular monolith** with a
**transactional outbox**, **domain events**, an **example saga**, **schedulers**, and a strict
**business ↔ infrastructure boundary** enforced by ESLint.

Full design document: [ARCHITECTURE.md](./ARCHITECTURE.md)

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

# Submit — the PurchaseOrderSaga validates the vendor & products and auto-approves
curl -X POST http://localhost:4000/api/v1/purchase-orders/<po-id>/submit
```

Every state change writes the resulting domain events into the **transactional outbox**
(in the same DB transaction) and the scheduler publishes them to **RabbitMQ** (and optionally
**Kafka** via `MessageRoutingPolicy`).

---

## Project Layout

```text
src/
├── config/            # .env-driven typed configuration
├── shared-kernal/     # NestJS technical concerns (filters, interceptors, pipes, pagination)
├── bootstrap/         # app bootstrap (security, cors, http, swagger, shutdown)
├── infrastructure/    # adapters: Prisma, Redis, RabbitMQ, Kafka, repositories, mappers
├── platform/          # outbox, event bus, saga, scheduler, message routing
└── business/
    ├── shared-business/   # domain/application/port primitives
    ├── product/           # Product aggregate
    ├── vendor/            # Vendor aggregate
    └── purchase-order/    # PurchaseOrder aggregate (uses vendor/product inbound ports)
```

## Scripts

| Command | Purpose |
|---|---|
| `npm run start:dev` | watch mode dev server |
| `npm run build` | compile to `dist/` |
| `npm run lint` | ESLint + architecture import restrictions |
| `npm test` | unit tests (aggregates, use cases with fakes) |
| `npm run test:e2e` | e2e smoke (requires `docker compose up -d`) |
| `npx prisma migrate dev` | create/apply migration + regenerate client |
| `npm run db:seed` | seed products/vendors |
| `prisma studio` | Prisma Studio UI |
