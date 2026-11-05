# ERP Boilerplate — NestJS Event-Driven Modular Monolith

A production-oriented ERP backend foundation using **NestJS 11 + TypeScript (strict) + PostgreSQL (Prisma 7)**,
structured as a **DDD / Hexagonal (Ports & Adapters) modular monolith** with a **transactional outbox**,
**domain events**, a **CQRS-style command/query split**, **RBAC/ABAC authorization**, **multi-tenancy**, and
a strict **business ↔ infrastructure boundary** enforced by ESLint.

## What this project is

This is an ERP boilerplate that demonstrates how to build a modular, domain-driven backend where:

- **Business modules** (Vendor, Product, Purchase Order, Good Receipt Note, Invoice) own their aggregates,
  domain logic, and persistence through port/adapter boundaries.
- **Platform services** (Outbox, Context, Authentication, Authorization, Configuration, Numbering, Audit,
  Cache, Idempotency, Messaging, Inbox, Scheduler, Recurring, Batch Operation, Import, Saga, Webhook,
  Notification, Storage, Condition Engine, Observability, Locking) expose capabilities as injectable ports.
- **Infrastructure** initializes third-party clients (Prisma, Redis, RabbitMQ, Kafka, SQS, SES, S3) and
  exposes them only to platform services.
- **Tenancy** is enforced at the data layer — every business table carries `tenantId`/`companyId`, and
  cross-tenant access returns 404 (never 403).
- **Authorization** flows through CLS-request context → RBAC guard (route level) → ABAC port (usecase level),
  with no-op adapters until the full IAM service is implemented.
- **Side effects** leave via the transactional outbox — domain events are persisted atomically with the
  aggregate change and published by a scheduler.

## Documentation index

| Document | Purpose |
|----------|---------|
| [`docs/architecture.md`](docs/architecture.md) | System architecture, layers, dependency direction, port/adapter rules |
| [`docs/business-modules.md`](docs/business-modules.md) | Business module anatomy, aggregate patterns, use case conventions |
| [`docs/platform-services.md`](docs/platform-services.md) | Platform layer services, ports, adapters, registration |
| [`docs/authentication-authorization.md`](docs/authentication-authorization.md) | Tenancy, CLS context, RBAC guard, ABAC port, no-op IAM adapters |
| [`docs/outbox-events-messaging.md`](docs/outbox-events-messaging.md) | Transactional outbox, domain/integration events, brokers, listeners |
| [`docs/data-model.md`](docs/data-model.md) | Prisma schema, tables, tenancy model, natural keys |
| [`docs/api-endpoints.md`](docs/api-endpoints.md) | HTTP API, controllers, DTOs, response envelopes, versioning |
| [`docs/getting-started.md`](docs/getting-started.md) | Quick start, environment setup, scripts |
| [`docs/verification.md`](docs/verification.md) | Type checking, lint, format, build, DI smoke test, e2e tests |
| [`docs/ai-models-agents.md`](docs/ai-models-agents.md) | AI models and agents: architecture, capabilities, integration, workflows |
| [`docs/service-module-development.md`](docs/service-module-development.md) | How to design, develop, extend, and maintain service modules |
| [`rules/architecture-rules.md`](rules/architecture-rules.md) | Hard rules enforced by ESLint architecture boundaries |
| [`rules/coding-standards.md`](rules/coding-standards.md) | TypeScript, NestJS, naming conventions |

## Quick start

```bash
cp .env.example .env
docker compose up -d          # PostgreSQL, Redis, RabbitMQ, Kafka
npm install                   # postinstall runs prisma generate
npm run db:push               # create/sync database straight from prisma/schema
npm run start:dev             # API + Swagger on http://localhost:4000/api/v1
```

Then:

- REST API: `http://localhost:4000/api/v1`
- Swagger: `http://localhost:4000/api/docs`
- RabbitMQ UI: `http://localhost:15672` (guest/guest)

## Core technology stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js + NestJS 11 |
| Language | TypeScript (strict mode) |
| Database | PostgreSQL + Prisma 7 ORM |
| Caching | Redis or Memcached (driver-selectable) |
| Messaging | RabbitMQ / Kafka / SQS (abstraction via `MessageQueuePort`) |
| CLS / Request context | `nestjs-cls` |
| Validation | Zod via `nestjs-zod` (`createZodDto`) |
| HTTP server | Fastify |
| API docs | Swagger (`/api/docs`, disabled in production) |
| Error tracking | Sentry |
| Observability | Prometheus metrics + structured JSON logging |

## Example API flow

```bash
# Create a product
curl -X POST http://localhost:4000/api/v1/products \
  -H "Content-Type: application/json" \
  -d '{"sku":"SKU-100","name":"Wireless Mouse","unitPrice":19.99,"currency":"USD"}'

# Create a vendor
curl -X POST http://localhost:4000/api/v1/vendors \
  -H "Content-Type: application/json" \
  -d '{"code":"VEN-100","name":"Acme Supplies","email":"billing@acme.com"}'

# Create a purchase order
curl -X POST http://localhost:4000/api/v1/purchase-orders \
  -H "Content-Type: application/json" -d '{"vendorId":"<vendor-id>"}'

# Add a line
curl -X POST http://localhost:4000/api/v1/purchase-orders/<po-id>/lines \
  -H "Content-Type: application/json" \
  -d '{"productId":"<product-id>","quantity":3,"unitPrice":19.99}'

# Submit — ABAC evaluated from CLS context; domain events written to outbox
curl -X POST http://localhost:4000/api/v1/purchase-orders/<po-id>/submit
```

## Verification battery

Run after every change:

```bash
npx tsc --noEmit -p tsconfig.json
npm run lint:check
npm run format:check
npm run docs:di
npm run build
NODE_ENV=test node -e "(async()=>{const{NestFactory}=require('@nestjs/core');const{AppModule}=require('./dist/app.module.js');const a=await NestFactory.create(AppModule,{preview:true});await a.init();await a.close();})()"
```

See [`docs/verification.md`](docs/verification.md) for details.
