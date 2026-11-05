# AGENTS.md — ERP DDD Boilerplate: Rules for Coding Agents & Contributors

NestJS 11 + TypeScript (strict) + Prisma 7 + PostgreSQL. DDD/hexagonal modular
monolith: `src/business` (aggregates) consumes `src/platform` (capabilities)
through injected port tokens only. Read `README.md` first, then this file for
the load-bearing summary.

## Before writing any code

| Doing… | You MUST read |
|--------|---------------|
| Reviewing/standardizing a **business module** | `docs/business-modules.md`, then `rules/architecture-rules.md`, then inspect the actual module before changing it. |
| A new **platform service** | `docs/architecture.md` §4 + §9, then follow `docs/platform-services.md` step by step. |
| A new **business module** | `docs/business-modules.md`, then `docs/architecture.md` §3–§5 + §15, then `docs/service-module-development.md`. Copy `src/business/procurement/product` as the layout reference. |
| Touching an existing platform service | That service's own README under `src/platform/<service>/README.md`. |
| Anything DB | `prisma/schema/<context>/*.prisma` header comments (table contracts). **No Prisma migrations** — edit the schema, then `npm run db:push` and `npx prisma generate`. |

## Hard rules (ESLint-enforced boundaries — `npm run lint:check` fails otherwise)

0. **Business tables are tenant-scoped**: `purchase_orders`, `good_receipt_notes`,
   `products`, `vendors` and `invoices` carry `tenantId`/`companyId`, stamped from
   the request context on create and filtered on every read and write. A foreign row
   is **404**, never 403. A document's natural key is unique within its company,
   not globally.

1. `src/platform/**` may not import `@business/**` (platform owns its event contract:
   the structural `OutboxEvent` interface in `src/platform/outbox/outbox.types.ts`;
   no event registry, no rehydration — the outbox stores the payload verbatim).

2. Business modules import ONLY: `@platform` exported tokens via
   `imports: [PlatformModule]`, another module's `public/**` or
   `application/outbound-ports/**` contract, and `shared-business` primitives.
   Domain folders import no `@nestjs/*`.

3. Raw clients (Prisma generated, amqplib/kafkajs/ioredis/redis) →
   `infrastructure/config/bootstrap/platform` only.

4. Hand-written `$queryRaw` must use the **physical column names** — platform tables
   are not uniform (`outbox_messages`, `inbox_messages`, `saga_steps` are snake_case,
   the rest camelCase). A wrong column name fails silently on every call.

5. Side effects that leave the process go through `OutboxWriterPort` inside the
   caller's `@Transactional()` — never publish from a use case.

6. All command use cases read context from `RequestContextPort` (CLS) and call
   `AbacPort.evaluate()` before business steps. Never inject `AuthenticationPort`
   or `CompanyConfigPort` directly into a use case.

7. RBAC is enforced at the route level by `RbacGuard` + `@Rbac()` decorator,
   reading `userId` from CLS `RequestContext`.

## Platform service invariants

- Every owned table is tenant-scoped (`tenantId String?`); reads enforce
  `TenantScope.assertVisible` (foreign → 404, no leak); `TENANCY_MODE=multi` makes
  identity JWT-verified and fail-closed.
- Claims are idempotent by construction: `FOR UPDATE SKIP LOCKED` (lease column +
  reconcile cron) or insert-as-claim on a unique key; every state write is CAS/
  token-fenced so redeliveries re-run but never double-apply.
- Reuse shared primitives: `platform/locking` (DistributedLockPort),
  `platform/idempotency` (IdempotencyPort + `@Idempotent()`),
  `platform/context` (`requestContext.run` in every worker),
  `platform/numbering`, `platform/audit`, `platform/outbox`.
- Bounded retries with visible parked states (`FAILED`/`SUSPENDED`/`DEAD_LETTER`);
  every background state has a reconciler cron.
- File pattern: one use case per file (`<verb>-<noun>.usecase.ts`), one request DTO
  per file (`http/requests/*.request.dto.ts`, Zod via `createZodDto`), ports are
  abstract classes used as DI tokens, providers use `useExisting`, module file
  contains bindings/exports only, `@Global()` is never used.
- Business opt-in registries are bridged by the **composition root**
  `src/bootstrap/configure-*.ts` — generated adapters stay pure port data, no
  lifecycle, only platform ports.

## Verification battery (run after ANY change)

```bash
npx tsc --noEmit -p tsconfig.json     # types
npm run lint:check                    # ESLint incl. architecture boundaries
npm run format:check                  # prettier
npm run docs:di                       # regenerate docs/DI-WIRING.md
npm run build                         # compile to dist/
NODE_ENV=test node -e "(async()=>{const{NestFactory}=require('@nestjs/core');const{AppModule}=require('./dist/app.module.js');const a=await NestFactory.create(AppModule,{preview:true});await a.init();await a.close();})()"  # DI graph smoke
```

## Open work — build next

- **IAM / Auth is deferred and NOT implemented.** The repo today only has the
  tenancy guard (`src/platform/platform-common/context/guards/tenancy-auth.guard.ts`)
  + `src/config/auth.config.ts`. RBAC/ABAC ports exist with no-op adapters; replace
  them with real implementations when IAM is built.
- **Optimistic concurrency** is implemented on PurchaseOrder and GRN only.
  Vendor, Product and Invoice command repositories are still last-write-wins.

## Commit/PR hygiene

- Do not commit secrets or `.env`.
- Prisma schema files are the table contracts — review them against the code that reads them.
- Public contracts only change with explicit owner approval.
- Never edit `src/generated/**`.
