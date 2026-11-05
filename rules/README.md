# ERP Boilerplate — Implemented Features & Rules

This folder documents **what is actually implemented** in the codebase, organized
by area. It is a companion to `docs/` (which holds target architecture rules,
roadmaps and guides) and `AGENTS.md` / `ARCHITECTURE.md` (source of truth for
design). Use this folder to understand current behavior before changing code.

## Contents

| File | Scope |
| --- | --- |
| [`architecture.md`](./architecture.md) | Architecture, folder map, module anatomy, dependency direction, ports/adapters, HTTP/errors, testing |
| [`business-modules.md`](./business-modules.md) | Business modules (vendor, product, purchase-order, good-receipt-note, invoice): aggregates, invariants, policies, events, endpoints |
| [`platform-services.md`](./platform-services.md) | Platform services under `src/platform` (outbox, inbox, numbering, locking, idempotency, cache, scheduler, recurring, saga, batch, import, notification, webhook, audit, context, tenancy, config, …) |
| [`api-endpoints.md`](./api-endpoints.md) | HTTP endpoints exposed by business controllers |
| [`data-model.md`](./data-model.md) | Prisma schemas / tables by context |
| [`events.md`](./events.md) | Domain events emitted and consumed |
| [`configuration.md`](./configuration.md) | Environment configuration knobs |

## Project at a glance

- Stack: NestJS 11 + TypeScript (strict) + Prisma 7 + PostgreSQL.
- Style: DDD / hexagonal modular monolith; `src/business` (aggregates) consumes
  `src/platform` (capabilities) through injected port tokens only.
- Multi-tenancy: `TENANCY_MODE=single|multi`; business tables carry
  `tenantId`/`companyId`, stamped from request context.
- Side effects leave the process only via `OutboxWriterPort` inside a
  `@Transactional()` boundary.
- Verification: `npx tsc --noEmit`, `npm run lint:check`, `npm run format:check`,
  `npm run docs:di`, `npm run build`, DI smoke, `npm run test:e2e`.

## Conventions (implemented)

- One use case per file: `<verb>-<noun>.usecase.ts`.
- One request DTO per file: `http/requests/*.request.dto.ts` (zod via
  `createZodDto`).
- Ports are abstract classes used as DI tokens; providers use `useExisting`.
- Module files contain bindings/exports only; `@Global()` is never used.
- Business opt-in registries bridged by composition root
  `src/bootstrap/configure-*.ts`.
- No Prisma migrations: edit `prisma/schema`, then `npm run db:push` +
  `npx prisma generate`.
