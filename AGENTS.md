# AGENTS.md — ERP DDD boilerplate: rules for coding agents & new contributors

NestJS 11 + TypeScript (strict) + Prisma 7 + PostgreSQL. DDD/hexagonal modular
monolith: `src/business` (aggregates) consumes `src/platform` (capabilities)
through injected port tokens only. Read `ARCHITECTURE.md` first — it is the
source of truth; this file is the load-bearing summary.

## Before writing any code

| Doing… | You MUST read |
| --- | --- |
| a new **platform service** | `ARCHITECTURE.md` §4 + §9.2, then follow **`docs/PLATFORM-SERVICE-GUIDE.md` step by step** (naming map, code templates, invariants checklist) |
| a new **business module** | `ARCHITECTURE.md` §3, §4, §5 + §15 checklist, then follow **`docs/BUSINESS-MODULE-GUIDE.md` step by step** (naming map, code templates, acceptance checklist); copy `src/business/procurement/product` as the reference layout |
| touching an existing platform service | that service's own `src/platform/<x>/README.md` (who calls it / how — already documented per module) |
| anything DB | `prisma/schema/<context>/*.prisma` header comments (table contracts), existing migrations; write hand-authored SQL into `prisma/migrations/<ts>_<name>/migration.sql`, run `npx prisma generate` |

## Hard rules (ESlint-enforced boundaries — `npm run lint:check` fails otherwise)

1. `src/platform/**` may not import `@business/**` (platform owns its event
   contract: `@platform/events/bases/outbox-event.base.ts` +
   `outboxEventRegistry`; the composition root `src/bootstrap/` bridges
   business rehydrators in as delegates — never the other way).
2. Business modules import ONLY: `@platform` exported tokens via
   `imports: [PlatformModule]`, another module's `public/**` or
   `application/outbound-ports/**` contract, and `shared-business` primitives.
   Domain folders import no `@nestjs/*`.
3. Raw clients (Prisma generated, amqplib/kafkajs/ioredis/…) →
   `infrastructure/config/bootstrap/platform` only.
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
  re-dispatch and `outboxEventRegistry`).
- Bounded retries with visible parked states (`FAILED`/`SUSPENDED`/
  `DEAD_LETTER`); every background state has a reconciler cron.
- File pattern: **one use case per file** (`<verb>-<noun>.usecase.ts`),
  **one request DTO per file** (`http/requests/*.request.dto.ts`, zod via
  `createZodDto`), ports are abstract classes used as DI tokens, providers use
  `useExisting`, module file contains bindings/exports only, `@Global()` is
  never used, registries are filled by the **handler's own**
  `onApplicationBootstrap` (self-registering adapter — owner module classes
  stay pure `@Module` declarations; import/scheduler legacy module-side
  registration migrates on touch).
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
npm test                              # unit tests (fake-based; no DB)
npm run format:check                  # prettier
npm run docs:di                       # Regenerate docs/DI-WIRING.md when modules/providers change
```

DB-backed e2e (`npm run test:e2e`) needs `docker compose up -d` + `.env`;
it must not be marked passing without running it.

## Commit/PR hygiene

Do not commit secrets or `.env`; SQL migrations are hand-written and reviewed
against the schema; public contracts only change with explicit owner approval;
never edit `src/generated/**`.
