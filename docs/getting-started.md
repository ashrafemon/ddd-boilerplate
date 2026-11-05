# ERP Boilerplate — Getting Started

## Prerequisites

- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 15+, Redis 7+, RabbitMQ 3.12+, Kafka 3.x (via Docker Compose)

## Installation

```bash
# 1. Clone the repository
git clone <repo-url>
cd ddd-boilerplate

# 2. Copy environment file
cp .env.example .env

# 3. Start infrastructure services
docker compose up -d

# 4. Install dependencies (postinstall runs prisma generate)
npm install

# 5. Create/sync the database from the Prisma schema
npm run db:push

# 6. Seed sample data (optional)
npm run db:seed

# 7. Start the development server
npm run start:dev
```

The API is available at `http://localhost:4000/api/v1`.
Swagger UI is at `http://localhost:4000/api/docs` (disabled in production).

## Environment variables

Create `.env` from `.env.example`. Key variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment (`development`/`production`) | `development` |
| `APP_HOST` | API host | `0.0.0.0` |
| `APP_PORT` | API port | `4000` |
| `DATABASE_URL` | PostgreSQL connection string | — |
| `DATABASE_READ_URL` | Read replica URL (falls back to write URL) | — |
| `RABBITMQ_URL` | RabbitMQ connection string | — |
| `KAFKA_BROKERS` | Kafka broker list | — |
| `SQS_URL` | SQS queue URL | — |
| `REDIS_URL` | Redis connection string | — |
| `JWT_ACCESS_SECRET` | JWT access token secret | — |
| `TENANCY_MODE` | `single` or `multi` | `single` |
| `OUTBOX_POLL_INTERVAL_MS` | Outbox scheduler poll interval | `10000` |
| `OUTBOX_MAX_ATTEMPTS` | Max outbox publish attempts | `5` |
| `SENTRY_DSN` | Sentry DSN (optional) | — |

## Available scripts

| Command | Purpose |
|---------|---------|
| `npm run start:dev` | Watch mode dev server |
| `npm run build` | Compile to `dist/` |
| `npm run start:prod` | Run compiled production build |
| `npm run lint` | ESLint + architecture import restrictions (`--fix`) |
| `npm run lint:check` | ESLint + architecture checks (read-only) |
| `npm run format:check` | Prettier format check |
| `npm test` | Unit tests (`--passWithNoTests`) |
| `npm run test:e2e` | E2E smoke tests (requires `docker compose up -d`) |
| `npm run db:push` | Create/sync database from `prisma/schema` |
| `npm run db:generate` | Regenerate Prisma client into `src/generated/` |
| `npm run db:seed` | Seed products/vendors |
| `npm run prisma:studio` | Prisma Studio UI |
| `npm run docs:di` | Regenerate `docs/DI-WIRING.md` |

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

See `docs/verification.md` for details.

## First API calls

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
  -H "Content-Type: application/json" \
  -d '{"vendorId":"<vendor-id>"}'
```

## Multi-tenancy headers (single mode)

```bash
curl -X POST http://localhost:4000/api/v1/products \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: <tenant-id>" \
  -H "x-company-id: <company-id>" \
  -H "x-user-id: <user-id>" \
  -H "x-roles: admin,manager" \
  -d '{"sku":"SKU-200","name":"Keyboard","unitPrice":49.99,"currency":"USD"}'
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Prisma client errors | Run `npx prisma generate` then `npm run build` |
| Database connection refused | Ensure `docker compose up -d` is running and `DATABASE_URL` is correct |
| RabbitMQ publish failures | Ensure RabbitMQ is running; outbox will retry automatically |
| ESLint architecture errors | Check import direction — business modules must not import `@infrastructure/**` |
| DI smoke test fails | Run `npm run docs:di` then `npm run build` |
