# ERP Boilerplate — Architecture Rules

Hard rules enforced by ESLint (`npm run lint:check` fails otherwise). These rules define the
dependency boundaries between layers in the DDD/hexagonal modular monolith.

## Rule 0 — Business tables are tenant-scoped

`purchase_orders`, `good_receipt_notes`, `products`, `vendors` and `invoices` carry
`tenantId`/`companyId`, stamped from the request context on create and filtered on every
read and write. A foreign row is **404**, never 403. A document's natural key is unique
within its company, not globally.

## Rule 1 — Platform may not import business

`src/platform/**` may not import `@business/**` (platform owns its event contract: the
structural `OutboxEvent` interface in `src/platform/outbox/outbox.types.ts`; no event
registry, no rehydration — the outbox stores the payload verbatim).

## Rule 2 — Business module imports

Business modules import ONLY:

- `@platform` exported tokens via `imports: [PlatformModule]`
- Another module's `public/**` or `application/outbound-ports/**` contract
- `shared-business` primitives

Domain folders import no `@nestjs/*`.

## Rule 3 — Raw clients

Raw clients (Prisma generated, `amqplib`, `kafkajs`, `ioredis`/`redis`) →
`infrastructure/config/bootstrap/platform` only.

## Rule 4 — Physical column names

Hand-written `$queryRaw` must use the **physical column names** — platform tables are not
uniform (`outbox_messages`, `inbox_messages`, `saga_steps` are snake_case, the rest
camelCase). A wrong column name fails silently on every call.

## Rule 5 — Side effects via outbox

Side effects that leave the process go through `OutboxWriterPort` inside the caller's
`@Transactional()` — never publish from a use case.

## Rule 6 — Use case context and ABAC

All command use cases read context from `RequestContextPort` (CLS) and call
`AbacPort.evaluate()` before business steps. Never inject `AuthenticationPort` or
`CompanyConfigPort` directly into a use case.

## Rule 7 — RBAC at route level

RBAC is enforced at the route level by `RbacGuard` + `@Rbac()` decorator, reading
`userId` from CLS `RequestContext`.

## Allowed imports matrix

| From | May import |
|------|-----------|
| `infrastructure` | third-party clients + config + shared-kernel exceptions only |
| `platform` | infrastructure clients ONLY — zero `@business/**` imports |
| `business module` | its own internals, `@platform` ports, `shared-business`, `shared-kernel` types, another module's `public/**` or `application/outbound-ports/**` contract |

## Forbidden imports matrix

| From | May not import |
|------|---------------|
| `domain` | `@nestjs/common`, `@nestjs/core`, `@nestjs/config`, `@nestjs/event-emitter` |
| `business` | `@infrastructure/**` (always; listeners included) |
| `business` | internals of another module: `domain/**`, `application/queries/**`, `application/usecases/**`, `application/integrations/**`, `application/facades/**`, `infrastructure/**` |
| `shared-business` | `@platform/**`, `@infrastructure/**`, any concrete module (`@business/*/*/**`) |
| `platform` | `@business/**` (ANY, including `shared-business`) |

## Carve-out

`application/integrations/listeners/**` may use the subscribe decorators
(`@RabbitSubscribe`, `@KafkaEvent`, `@SqsMessageHandler`, `@OnEvent`) but not the raw client
libraries, and handlers must delegate to use cases — never run business logic inline.

## Additional conventions

- No Prisma migrations — edit schema, then `npm run db:push` and `npx prisma generate`
- One use case per file (`<verb>-<noun>.usecase.ts`)
- One request DTO per file (`http/requests/*.request.dto.ts`, Zod via `createZodDto`)
- Ports are abstract classes used as DI tokens
- Providers use `useExisting`
- Module file contains bindings/exports only
- `@Global()` is never used
- Business opt-in registries bridged by composition root `src/bootstrap/configure-*.ts`
- Never edit `src/generated/**`
- Do not commit secrets or `.env`
