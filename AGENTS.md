# AGENTS.md — ERP DDD Boilerplate: Rules for Coding Agents & Contributors

NestJS 11 + TypeScript (strict) + Prisma 7 + PostgreSQL. DDD/hexagonal modular monolith:
`src/business` (aggregates) consumes `src/platform` (capabilities) through injected port tokens
only. Read `README.md` first, then this file.

## Before writing any code

| Doing… | You MUST read |
|--------|---------------|
| Business module work | `docs/architecture.md` (module anatomy, dependency rules) |
| New platform service | `docs/architecture.md` (§platform layer), inspect existing service |
| Anything DB | `prisma/schema/<context>/*.prisma` header comments. **No migrations** — edit schema, then `npm run db:push` and `npx prisma generate` |

## Hard rules (ESLint-enforced — `npm run lint:check` fails otherwise)

0. Business tables are tenant-scoped (`tenantId`/`companyId`). Foreign row = **404**, never 403.
   Natural key unique within company, not globally.
1. `src/platform/**` may not import `@business/**`.
2. Business modules import ONLY: `@platform` exported tokens via `imports: [PlatformModule]`,
   another module's `public/**` or `application/outbound-ports/**`, and `shared-business`
   primitives. Domain folders import no `@nestjs/*`.
3. Raw clients (Prisma, `amqplib`, `kafkajs`, `ioredis`/`redis`) →
   `infrastructure/config/bootstrap/platform` only.
4. Hand-written `$queryRaw` must use **physical column names**.
5. Side effects that leave the process go through `OutboxWriterPort` inside
   `@Transactional()` — never publish from a use case.
6. Command use cases read context from `RequestContextPort` (CLS) and call
   `AbacPort.evaluate()` before business steps. Never inject `AuthenticationPort` or
   `CompanyConfigPort` directly into a use case.
7. RBAC enforced at route level by `RbacGuard` + `@Rbac()` decorator, reading `userId` from CLS.

## Platform invariants

- Every owned table tenant-scoped (`tenantId String?`); reads enforce `TenantScope.assertVisible`
  (foreign → 404); `TENANCY_MODE=multi` makes identity JWT-verified and fail-closed.
- Claims idempotent by construction: `FOR UPDATE SKIP LOCKED` or insert-as-claim on unique key;
  state writes CAS/token-fenced.
- Reuse shared primitives: `platform/locking`, `platform/idempotency`, `platform/context`,
  `platform/numbering`, `platform/audit`, `platform/outbox`.
- File pattern: one use case per file (`<verb>-<noun>.usecase.ts`), one request DTO per file
  (`http/requests/*.request.dto.ts`, Zod via `createZodDto`), ports are abstract classes as DI
  tokens, providers use `useExisting`, module file contains bindings/exports only,
  `@Global()` never used.
- Business opt-in registries bridged by composition root `src/bootstrap/configure-*.ts`.

## Verification battery (run after ANY change)

```bash
npx tsc --noEmit -p tsconfig.json
npm run lint:check
npm run format:check
npm run docs:di
npm run build
NODE_ENV=test node -e "(async()=>{const{NestFactory}=require('@nestjs/core');const{AppModule}=require('./dist/app.module.js');const a=await NestFactory.create(AppModule,{preview:true});await a.init();await a.close();})()"
```

## Open work

- **IAM / Auth deferred**: RBAC/ABAC ports exist with no-op adapters; real implementation pending.
- **Optimistic concurrency**: PurchaseOrder and GRN only; Vendor/Product/Invoice are last-write-wins.

## Commit hygiene

- Do not commit secrets or `.env`.
- Never edit `src/generated/**`.
- Public contracts change only with explicit owner approval.
- Commit only when explicitly requested.
