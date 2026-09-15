# Platform Service Guide — building a new `src/platform/<service>` strictly to spec

This document is the executable companion to `ARCHITECTURE.md` §9. Follow it top to
bottom and the result is lint-clean, DI-correct, tenant-safe. The newest reference
implementations are **`platform/locking`** (minimal) and **`platform/idempotency`**
(full: DB table + HTTP decorator + interceptor + reconciler + tests) — mimic them.

Rule of thumb for ownership: if the capability makes sense with **zero domain
knowledge** (scheduling, shipping, retries, storage…), it is a platform service;
if it needs an aggregate's rules, it is a business module (§3 + §15).

---

## 1. Naming map (every file you create)

| Artifact | Pattern | Real reference |
| --- | --- | --- |
| module | `<service>.module.ts` | `locking/locking.module.ts` |
| shared module types (records/enums) | `<service>.types.ts` at module root | `scheduler/scheduler.types.ts`, `batch-operation/batch-operation.types.ts` |
| specs | colocated `<impl>.spec.ts` next to the file they test (NEVER in the module root) | `idempotency/repositories/prisma-idempotency.repository.spec.ts` |
| README | `README.md` (mandatory, §5 template) | `idempotency/README.md` |
| DI token port | `<what>.port.ts` → `export abstract class <What>Port` (OUTBOUND repo ports: `<what>-repository.port.ts`) | `recurring/ports/recurring-template-repository.port.ts` |
| use cases | `<verb>-<noun>.usecase.ts` → **ONE class per file** `class <VerbNoun>UseCase` |
| shared use-case code | `<service>-helpers.ts` in `usecases/` | `import/usecases/import-helpers.ts` | `scheduler/usecases/dispatch-due-jobs.usecase.ts` |
| Prisma repo | `repositories/prisma-<thing>.repository.ts` (+ colocated `.spec.ts`) | `idempotency/repositories/prisma-idempotency.repository.ts` |
| non-DB adapter | `adapters/<tech>-<thing>.adapter.ts` (workers: `adapters/bullmq-<thing>.worker.ts`) | `locking/adapters/redis-distributed-lock.adapter.ts` |
| controller | `http/<thing>.controller.ts` | `scheduler/http/scheduler.controller.ts` |
| request DTO | `http/requests/<verb>-<noun>.request.dto.ts` → **ONE DTO per file** (shared zod schema: `<noun>.schema.ts`) | `idempotency/http/…` + `batch-operation/http/requests/batch-operation-selection.schema.ts` |
| platform event | `events/<thing>-<past-verb>.event.ts` extends `OutboxEventBase` | `import/events/import-job-completed.event.ts` |
| rehydrator wiring | `events/<service>.registry.ts` → `outboxEventRegistry.register('<EventClass>', p => new …)` | `recurring/events/recurring.registry.ts` |
| cron converger | `<service>-reconciliation.ts` (or `usecases/sweep-<x>.usecase.ts` w/ `@Cron`) | `idempotency/idempotency-reconciliation.ts` |
| in-memory fakes | `__testing__/in-memory-<thing>.repository.ts` | `batch-operation/__testing__/…` |
| prisma schema | `prisma/schema/platform/<service>.prisma` (header comment = table contract) | `platform/idempotency.prisma` |
| migration | `prisma/migrations/<YYYYMMDDHHMMSS>_<snake_name>/migration.sql` (hand-written SQL) | `20260915025800_idempotency_ledger` |
| config | `src/config/<service>.config.ts` + `ConfigService.get<Upper>()` facade getter + `.env.example` comment | `src/config/idempotency.config.ts` |

## 2. Build order (do not reorder — each step keeps gates green)

```bash
# 1) contract first — ports define the product
mkdir -p src/platform/<svc>/{ports,repositories,usecases,http/requests}
# 2) schema + migration (if the service owns tables)
#    edit prisma/schema/platform/<svc>.prisma, write migrations/<ts>_<name>/migration.sql
npx prisma generate                      # client -> src/generated (offline-safe)
# 3) config (only if tunables exist)  -> src/config + ConfigService getter + .env.example
# 4) repository impl + colocated spec (fakes only, no DB)
# 5) use cases (one per file) + module (bindings only)
# 6) HTTP: controller + one-DTO-per-file requests, ParseUUIDPipe on uuid params
# 7) background: worker/cron files; wrap executions in requestContext.run(...)
# 8) events (if it announces anything): events/*.event.ts + <svc>.registry.ts
# 9) src/platform/platform.module.ts -> imports + exports list
# 10) src/platform/README.md catalog row; src/platform/<svc>/README.md (template §5)
# 11) docs/DI-WIRING.md  -> npm run docs:di
```

## 3. Code patterns (copy these shapes verbatim)

**Port (DI token — abstract class, NEVER an interface for injection):**
```ts
/** DI token (abstract class port). Implemented by PrismaXRepository. */
export abstract class XRepositoryPort {
  abstract find(id: string): Promise<XRecord | null>;
}
```

**Prisma repository (transactional writes via `TransactionHost`; conditional
`updateMany` CAS for every state write; raw SQL only for claims):**
```ts
@Injectable()
export class PrismaXRepository implements XRepositoryPort {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {}
  // claim: UPDATE ... WHERE id IN (SELECT ... FOR UPDATE SKIP LOCKED ...) RETURNING *
  // settle: updateMany + WHERE status IN (...) — never bare update()
}
```

**Use case (one per file; `@Transactional()` wraps multi-write commands; ops
mutations `audit.record`; tenant reads go through `TenantScope.assertVisible`):**
```ts
@Injectable()
export class CancelXUseCase {
  constructor(
    private readonly xs: XRepositoryPort,
    private readonly audit: AuditPort,
  ) {}
  @Transactional()
  async execute(id: string, tenantId?: string): Promise<void> {
    const row = await this.xs.find(id);
    if (!row) throw new NotFoundException(`X '${id}' not found`);
    TenantScope.assertVisible(row.tenantId ?? null, tenantId);
    await this.xs.cancel(id);
    await this.audit.record({ action: 'x.cancel', entityType: 'X', entityId: id });
  }
}
```

**Controller (thin, typed DTOs, no business logic; response = `{ data, message }`
— the global ResponseInterceptor wraps it):**
```ts
@ApiTags('<service>')
@ApiBearerAuth()
@Controller('<resources>')
export class XController {
  constructor(
    private readonly cancel: CancelXUseCase,
    @Inject(RequestContextPort) private readonly requestContext: RequestContextPort,
  ) {}
  @Post()
  @Idempotent()                                   // costly non-idempotent POST
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async submit(@Body() dto: SubmitXDto) {
    const ctx = this.requestContext.get();
    const data = await this.create.execute({ ...dto, tenantId: ctx?.tenantId });
    return { data, message: 'X created' };
  }
  @Get(':id')
  async get(@Param('id', new ParseUUIDPipe()) id: string) { /* 404-scope reads */ }
}
```

**Request DTO (zod is the validator — one DTO per file, business convention):**
```ts
export const cancelXSchema = z.object({ reason: z.string().max(500).optional() });
export class CancelXDto extends createZodDto(cancelXSchema) {}
```

**Background execution MUST restore tenancy first:**
```ts
await this.requestContext.run({ tenantId: row.tenantId, correlationId: row.idempotencyKey },
  () => this.handler.handle(payload));
```

**Leases & dedupe — never reinvent the primitives:**
- one-winner-now ⇒ `DistributedLockPort` (fail closed; release with the returned ticket),
- duplicate-effect suppression ⇒ `IdempotencyPort` / `@Idempotent()`,
- DB-level claim ⇒ insert-as-claim on a unique key or `FOR UPDATE SKIP LOCKED`
  with a `claimedAt` lease column + a reconcile cron (copy `outbox.repository.ts` /
  `idempotency.repository.ts` shapes).

**Module (bindings and exports ONLY — never `@Global()`, no logic in the root file):**
```ts
@Module({
  imports: [ContextModule, AuditModule /* + infra/bull as needed */],
  providers: [
    PrismaXRepository,
    { provide: XRepositoryPort, useExisting: PrismaXRepository },
    CreateXUseCase, CancelXUseCase,
  ],
  exports: [XPublicPort],       // export ONLY what other modules may inject
})
export class XModule {}
```

**Events the service announces** (so consumers can listen in-process or via
brokers — extends the PLATFORM base, not `@business/**`):
```ts
export class XCompleted extends OutboxEventBase { constructor(public readonly xId: string) { super(); } }
// events/<svc>.registry.ts
outboxEventRegistry.register('XCompleted', p => new XCompleted(String(p.xId)));
// writer: this.outbox.append(new XCompleted(id), 'XType', id) inside @Transactional
```

**Test pattern (no DB, no brokers):** colocated `*.spec.ts`, plain fakes
(`{ rehydrate: jest.fn() } as unknown as Port`) or `__testing__/` in-memory
repos; assert the guard rails (CAS where-clause, ticket release, reserve
outcomes), not the ORM.

## 4. Invariants checklist (enforced where noted)

- [ ] zero `@business/**` imports in platform files (ESLint regex in `eslint.config.mjs`)
- [ ] business can only consume your `exports` tokens (`PlatformModule` is its import)
- [ ] tables carry `tenantId String?` + `@@index` per tenant path; rows w/o tenant = platform-owned
- [ ] **nullable column inside a UNIQUE?** normalize NULL to `''` at the repository edge
  (Postgres treats NULLs as distinct — precedent: `idempotency_keys` scope normalization)
- [ ] reads: `TenantScope.assertVisible` → foreign ⇒ 404
- [ ] writes: insert-as-claim / SKIP-LOCKED claim / CAS `updateMany` (+ `claimToken`/`version`)
- [ ] any cross-process effect goes ONLY through `OutboxWriterPort` in the txn
- [ ] retries bounded → parked state (`FAILED`/`SUSPENDED`/`DEAD_LETTER`) + reconcile cron for stuck leases
- [ ] workers restore CLS via `RequestContextPort.run` before touching numbering/config/audit
- [ ] one DTO per file, one use case per file
- [ ] config via `src/config` + typed `ConfigService` getter + `.env.example` entry
- [ ] `README.md` present with all 7 template sections
- [ ] gates: `npx prisma generate && npx tsc --noEmit -p tsconfig.json && npm run lint:check && npm test && npm run build && npm run docs:di` all green
- [ ] DI-graph smoke (proves module wiring/exports, instantiates nothing — preview):
  `npm run build && node -e "process.env.NODE_ENV='test';(async()=>{const{NestFactory}=require('@nestjs/core');const{AppModule}=require('./dist/app.module.js');const a=await NestFactory.create(AppModule,{preview:true});await a.init();await a.close();})().then(()=>console.log('DI_OK'))"`
- [ ] registry opt-in (if exposed): the **handler self-registers** in its own
      `onApplicationBootstrap` (owner module class stays a pure `@Module` — §9.1); duplicates throw

## 5. Module README template (required in every `src/platform/<x>/README.md`)

```
# platform/<name> — <role>
> <what problem it removes>
## What it does
## Public API          (tokens/decorators + signatures + usage snippet)
## Layout              (file map, one-line roles)
## Who calls it / how called   (table; "none yet" is valid, say it)
## Data & config       (tables, migrations, env, ConfigService getter)
## Tenancy behaviour
## Rules & gotchas
```

**Provider style:** `useExisting` whenever the implementation class is ALSO a
listed provider (port aliases the single instance — the default you should
choose); `useClass` is only acceptable for a private implementation nobody
else injects (`observability`, `storage`). Never two bindings of the same class.

## 6. Shared cross-use-case helpers & known notes

- Code shared by several use cases of one service goes in
  `usecases/<service>-helpers.ts` (export the shared classes/functions;
  reference: `import/usecases/import-helpers.ts` — build guard + `StageLock`).
- Previously-flagged deviation `import/usecases/import.usecases.ts` (13 classes in
  one file) has been **split** to one-per-file per §1; no multi-use-case files remain.
- `configuration/repositories/company-config.repository.ts` is a repository but lives in
  `repositories/` while exposing an inbound port implementation (fine — reference it as
  "port-bound repository", the pattern for config reads).
- `CachePort`/`EmailPort`/`NotificationDispatchPort`/`ErrorTrackingPort` have no external
  consumers yet — ports may legally ship ahead of consumers; READMEs say so.

Business-module creation follows the same rigor via `ARCHITECTURE.md` §3 (anatomy) +
§15 (checklist) — its DTO/use-case naming is already one-per-file.
