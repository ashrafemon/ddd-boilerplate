# Generating a New Platform Service — AI Agent Guide

Target: one cross-cutting capability under `src/platform/platform-common/<service>/` or
`src/platform/platform-organization/<service>/`.
Reference layout: `src/platform/platform-common/context/`, `src/platform/platform-common/outbox/`.

## Required file structure

```
src/platform/<org>/<service>/
├── README.md                     REQUIRED — purpose, API, layout, who-calls/how, data/config, tenancy, rules
├── <service>.module.ts           bindings + exports ONLY (not @Global)
├── ports/                        abstract classes = DI tokens
│   ├── <service>.port.ts         inbound port
│   └── <name>.port.ts            outbound port (if consumes another platform service)
├── usecases/                     one class per capability
│   └── <verb>-<noun>.usecase.ts  @Transactional at boundary
├── repositories/                 Prisma data access (TransactionHost)
│   └── prisma-<service>-repository.ts
├── adapters/                     queue/broker/cache I/O adapters
│   └── <name>.adapter.ts
├── http/requests/*.request.dto.ts ONE DTO per file
├── <name>.ticker.ts              crons for crashed executions (if any)
└── __testing__/                  in-memory port fakes (if any)
```

## Module template

```ts
import { Module } from '@nestjs/common';
import { <Service>Port } from './ports/<service>.port';
import { <Service>Adapter } from './adapters/<service>.adapter';

@Module({
  providers: [
    <Service>Adapter,
    { provide: <Service>Port, useExisting: <Service>Adapter },
  ],
  exports: [<Service>Port],
})
export class <Service>Module {}
```

## PlatformModule registration

Add to `src/platform/platform.module.ts`:

```ts
import { <Service>Module } from './platform-common/<service>/<service>.module';
// or platform-organization/<service>

@Module({
  imports: [
    // ... existing imports
    <Service>Module,
  ],
  exports: [
    // ... existing exports
    <Service>Module,
  ],
})
export class PlatformModule {}
```

## Service README required sections

| Section | Content |
|---------|---------|
| What it does | Purpose and scope |
| Public API | Ports, methods, signatures |
| Layout | File/folder structure |
| Who calls it / how | Consumers and invocation patterns |
| Data & config | Tables, config keys, defaults |
| Tenancy behaviour | Tenant scoping, fail-closed rules |
| Rules & gotchas | Invariants, edge cases |

## Platform invariants

1. Every owned table gets `tenantId String?`; reads enforce `TenantScope.assertVisible` (foreign → 404).
2. Claims idempotent by construction: `FOR UPDATE SKIP LOCKED` or insert-as-claim on unique key.
3. State writes CAS/token-fenced (`version`, `status` where-guard, `claimToken`).
4. Side effects via `OutboxWriterPort` inside `@Transactional()` only.
5. Hand-written `$queryRaw` uses physical column names.
6. Bounded retries with visible parked states (`FAILED`/`SUSPENDED`/`DEAD_LETTER`).
7. File pattern: one use case per file, one request DTO per file, ports as abstract classes,
   providers use `useExisting`, module file bindings/exports only, `@Global()` never used.
8. Business opt-in registries bridged by `src/bootstrap/configure-*.ts`.

## ESLint rules to respect

- `src/platform/**` may not import `@business/**`
- Platform defines its own event contract (`OutboxEvent` structural interface)
- Raw clients → `infrastructure/config/bootstrap/platform` only
- `@nestjs/schedule` → platform only

## Verification after generating

```bash
npx tsc --noEmit -p tsconfig.json
npm run lint:check
npm run format:check
npm run docs:di
npm run build
NODE_ENV=test node -e "(async()=>{const{NestFactory}=require('@nestjs/core');const{AppModule}=require('./dist/app.module.js');const a=await NestFactory.create(AppModule,{preview:true});await a.init();await a.close();})()"
```
