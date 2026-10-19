# AGENTS.md — ERP DDD boilerplate: rules for coding agents & new contributors

NestJS 11 + TypeScript (strict) + Prisma 7 + PostgreSQL. DDD/hexagonal modular
monolith: `src/business` (aggregates) consumes `src/platform` (capabilities)
through injected port tokens only. Read `ARCHITECTURE.md` first — it is the
source of truth; this file is the load-bearing summary.

## Before writing any code

| Doing…                                | You MUST read                                                                                                                                                                                                                                            |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a new **platform service**            | `ARCHITECTURE.md` §4 + §9.2, then follow **`docs/PLATFORM-SERVICE-GUIDE.md` step by step** (naming map, code templates, invariants checklist)                                                                                                            |
| a new **business module**             | `ARCHITECTURE.md` §3, §4, §5 + §15 checklist, then follow **`docs/BUSINESS-MODULE-GUIDE.md` step by step** (naming map, code templates, acceptance checklist); copy `src/business/procurement/product` as the reference layout                           |
| touching an existing platform service | that service's own `src/platform/<x>/README.md` (who calls it / how — already documented per module)                                                                                                                                                     |
| anything DB                           | `prisma/schema/<context>/*.prisma` header comments (table contracts). **There are no Prisma migrations** — edit the schema, then `npm run db:push` (creates/syncs the DB straight from the schema) and `npx prisma generate` (client → `src/generated/`) |

## Hard rules (ESlint-enforced boundaries — `npm run lint:check` fails otherwise)

0. **Business tables are tenant-scoped**: `purchase_orders`, `good_receipt_notes`,
   `products`, `vendors` and `invoices` carry `tenantId`/`companyId`, stamped from
   the request context on create and filtered on every read and write. Owned
   documents are strict (`tenantId = request`); master data also includes
   unscoped (shared) rows. A foreign row is **404**, never 403 — see
   `TenantScope.where` in `src/shared-kernel/utils/tenant-scope.util.ts` and
   `test/tenant-isolation.e2e-spec.ts`.
1. `src/platform/**` may not import `@business/**` (platform owns its event
   contract: the structural `OutboxEvent` interface + `OutboxEventBase` in
   `src/platform/outbox/outbox.types.ts`; there is no event registry and no
   rehydration step — the outbox stores the payload verbatim).
2. Business modules import ONLY: `@platform` exported tokens via
   `imports: [PlatformModule]`, another module's `public/**` or
   `application/outbound-ports/**` contract, and `shared-business` primitives.
   Domain folders import no `@nestjs/*`.
3. Raw clients (Prisma generated, amqplib/kafkajs/ioredis/…) →
   `infrastructure/config/bootstrap/platform` only.
   **Hand-written `$queryRaw` must use the PHYSICAL column names** — the
   platform tables are not uniform (`outbox_messages`, `inbox_messages` and
   `saga_steps` are snake_case, the rest camelCase). A wrong column name fails
   the statement on every call, silently.
4. Side effects that leave the process go through `OutboxWriterPort` inside
   the caller's `@Transactional()` — never publish from a use case.

## Platform service invariants (beyond lint — from §9.2 / guide §4)

- Every owned table is tenant-scoped (`tenantId String?`) when it can be per
  tenant; reads enforce `TenantScope.assertVisible` (foreign ⇒ 404, no leak);
  `TENANCY_MODE=multi` makes identity JWT-verified and fail-closed.
- Claims are idempotent by construction: `FOR UPDATE SKIP LOCKED` (lease
  column + reconcile cron) or insert-as-claim on a unique key; every state
  write is CAS/token-fenced (`version`, `status` where-guard, `claimToken`) so
  redeliveries re-run but never double-apply.
- Reuse the shared primitives instead of re-inventing: `platform/locking`
  (DistributedLockPort), `platform/idempotency` (IdempotencyPort +
  `@Idempotent()`), `platform/context` (`requestContext.run` in every worker),
  `platform/numbering`, `platform/audit`, `platform/outbox` (+ stable-envelope
  re-dispatch on the same `OutboxEnvelope`).
- Bounded retries with visible parked states (`FAILED`/`SUSPENDED`/
  `DEAD_LETTER`); every background state has a reconciler cron.
- File pattern: **one use case per file** (`<verb>-<noun>.usecase.ts`),
  **one request DTO per file** (`http/requests/*.request.dto.ts`, zod via
  `createZodDto`), ports are abstract classes used as DI tokens, providers use
  `useExisting`, module file contains bindings/exports only, `@Global()` is
  never used, business opt-in registries are bridged by the **composition
  root** `src/bootstrap/configure-*.ts` (generated adapters stay pure port
  data — no lifecycle, only platform ports — recurring→scheduler is platform→platform
  and stays module-side).
- Every new/changed service keeps its `src/platform/<x>/README.md` current
  (sections: purpose/API/layout/**who-calls-how**/data/config/tenancy/rules).

## Business module rules (§3, §5)

Aggregate = sole mutation path (`domain/factories` invariant-enforced,
`aggregate.pullEvents()`); command use cases `@Transactional()` → repository
port → `outbox.append`; query repositories read through `PrismaReadPort`
(replica); cross-module calls go via inbound port + Rabbit listener or
`public/` contracts — never module internals.

## Verification battery (run after ANY change; agent must finish all green)

```bash
npx tsc --noEmit -p tsconfig.json     # types (generated client: npx prisma generate)
npm run lint:check                    # ESLint incl. architecture boundaries
npm run format:check                  # prettier
npm run docs:di                       # Regenerate docs/DI-WIRING.md when modules/providers change
npm run build && NODE_ENV=test node -e "(async()=>{const{NestFactory}=require('@nestjs/core');const{AppModule}=require('./dist/app.module.js');const a=await NestFactory.create(AppModule,{preview:true});await a.init();await a.close();})()"  # DI graph smoke
```

There are **no unit specs in `src/`** (they were removed in `0f32e4d`; `npm test`
runs with `--passWithNoTests` and reports "No tests found"). The DB-backed e2e
suite is the executable check: `npm run test:e2e` needs `docker compose up -d` +
`.env`, and it must not be marked passing without running it. It covers the DI
graph, the error envelope, the PO-07 receiving concurrency (two concurrent
receipts can never jointly exceed the over-receipt limit), the `grn.post`
idempotent replay, and cross-tenant isolation (another tenant's purchase order
is 404 and cannot be mutated).

## Open work — build next

- **IAM / Auth is deferred and NOT implemented.** The repo today only has the
  tenancy guard (`src/platform/context/guards/tenancy-auth.guard.ts`) +
  `src/config/auth.config.ts`. The full design (tenancy, identity,
  authentication/sessions, centers, membership, machine access, audit,
  authorization + SoD) lives in
  `~/Documents/Common/erp/iam/{index,iam,authorization}.html` and is distilled
  into **`docs/IAM-BUILD-PLAN.md`** — read that before starting.
- **Optimistic concurrency** is implemented on PurchaseOrder and GRN only.
  Vendor, Product and Invoice command repositories are still last-write-wins.

## Commit/PR hygiene

Do not commit secrets or `.env`; the Prisma schema files are the table
contracts — review them against the code that reads them; public contracts
only change with explicit owner approval; never edit `src/generated/**`.
