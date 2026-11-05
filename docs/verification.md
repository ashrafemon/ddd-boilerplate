# ERP Boilerplate — Verification

This document describes the verification battery that must pass after **any** change to the
codebase.

## Verification battery (run in order)

```bash
# 1. TypeScript type checking
npx tsc --noEmit -p tsconfig.json

# 2. ESLint including architecture boundaries
npm run lint:check

# 3. Prettier formatting
npm run format:check

# 4. Regenerate DI wiring documentation
npm run docs:di

# 5. Compile to dist/
npm run build

# 6. DI graph smoke test
NODE_ENV=test node -e "(async()=>{const{NestFactory}=require('@nestjs/core');const{AppModule}=require('./dist/app.module.js');const a=await NestFactory.create(AppModule,{preview:true});await a.init();await a.close();})()"
```

## What each step verifies

| Step | Verifies |
|------|----------|
| `tsc --noEmit` | All TypeScript compiles with strict mode; no type errors in source or generated client |
| `lint:check` | ESLint passes including architecture boundary rules (no forbidden imports between layers) |
| `format:check` | Prettier formatting is consistent across all files |
| `docs:di` | DI wiring documentation is up to date; all module bindings resolve |
| `build` | NestJS compiles successfully to `dist/` |
| DI smoke test | The NestJS application context initializes without dependency injection errors |

## E2E tests

The DB-backed e2e suite requires infrastructure:

```bash
docker compose up -d
npm run test:e2e
```

E2E specs cover:

| Spec | What it tests |
|------|---------------|
| `test/app.e2e-spec.ts` | DI graph, error envelope, basic API flow |
| `test/tenant-isolation.e2e-spec.ts` | Cross-tenant isolation (404, no 403 leak) |
| `test/receiving-concurrency.e2e-spec.ts` | PO-07 receiving concurrency (two concurrent receipts never exceed over-receipt limit) |
| `test/receiving-rollback.e2e-spec.ts` | GRN post idempotent replay |
| `test/purchase-order-amendment.e2e-spec.ts` | Controlled amendment of an issued order |
| `test/platform-services.e2e-spec.ts` | Background services: notification pipeline, batch-operation engine, outbox dispatch, inventory consumer |

## Common failures and fixes

| Failure | Likely cause | Fix |
|---------|-------------|-----|
| `tsc` error on `@prisma/client` | Bare specifier used instead of relative path | Import `../../../generated/client` |
| ESLint architecture error | Business module imports `@infrastructure/**` | Use `@platform` ports or `public/` contracts |
| ESLint architecture error | Platform module imports `@business/**` | Use `OutboxEvent` structural interface only |
| Prettier error | Inconsistent formatting | Run `npx prettier --write <file>` |
| DI smoke test fails | Missing provider binding | Check module `providers` array and `useClass`/`useExisting` |
| `db:push` fails | Schema mismatch | Review Prisma schema header comments; ensure column names match code |

## Pre-commit checklist

- [ ] `npx tsc --noEmit -p tsconfig.json` passes
- [ ] `npm run lint:check` passes
- [ ] `npm run format:check` passes
- [ ] `npm run docs:di` passes
- [ ] `npm run build` passes
- [ ] DI smoke test passes
- [ ] No secrets or `.env` committed
- [ ] No edits to `src/generated/**`
