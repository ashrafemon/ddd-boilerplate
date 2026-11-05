# Architecture & Coding Structure — Implemented

Source of truth: `ARCHITECTURE.md`. This file summarizes the implemented
structure so a new contributor can navigate the codebase.

## Top-level folder map (`src/`)

- `app.module.ts` — root composition root + global interceptors/filter/pipe.
- `main.ts` — entry point; calls `bootstrap()`.
- `config/` — `.env`-driven typed config blocks + `ConfigService` facade.
- `shared-kernel/` — filters, interceptors, pipes, decorators, exceptions, types.
- `bootstrap/` — app bootstrap steps (sentry, security, cors, http, swagger, ...).
- `infrastructure/` — third-party client init only (Prisma, brokers, cache, AWS, CLS).
- `platform/` — services built on infra clients, exposed as ports.
- `generated/` — Prisma-generated client (DO NOT EDIT).
- `business/` — aggregates; may never import `@infrastructure`.

Business contexts:

- `business/shared-business/` — framework-free domain primitives + registries.
- `business/party/vendor/`
- `business/procurement/product/`
- `business/procurement/purchase-order/`
- `business/procurement/good-receipt-note/`
- `business/sales/invoice/`

Each context has a thin composing module (`PartyModule`, `ProcurementModule`,
`SalesModule`), aggregated by `BusinessModule`.

## Module aliases (tsconfig + Jest)

| Alias | Path |
| --- | --- |
| `@config/*` | `src/config/*` |
| `@shared-kernel/*` | `src/shared-kernel/*` |
| `@bootstrap/*` | `src/bootstrap/*` |
| `@infrastructure/*` | `src/infrastructure/*` |
| `@platform/*` | `src/platform/*` |
| `@business/*` | `src/business/*` |
| `@test/*` | `test/*` |
| `@prisma/client` | `src/generated/client.ts` |

## Business module anatomy

Every aggregate module follows this shape:

```
business/<context>/<module>/
├── domain/
│   ├── aggregates/          # aggregate root + <name>.invariants.ts
│   ├── entities/            # child entities + their invariants
│   ├── value-objects/       # typed VOs + per-VO invariants
│   ├── events/              # domain events (outbox payload; no rehydrators)
│   ├── policies/            # policy definitions (policyRegistry)
│   ├── factories/           # aggregate factory — sole build path
│   ├── repositories/        # COMMAND repository port (abstract class = DI token)
│   └── types/               # enums + props/request/query-record aliases
├── application/
│   ├── usecases/            # one class per command/query operation
│   ├── queries/             # QUERY repository port
│   ├── facades/             # implementations of public/ ports
│   ├── outbound-ports/      # ports this module consumes
│   └── integrations/
│       ├── publishes/       # integration port + per-event wire shapes
│       └── listeners/       # broker/in-process listeners
├── infrastructure/
│   ├── persistence/         # Prisma command/query repos + mapper
│   └── adapters/
│       ├── platform/        # platform-facing port adapters (outbox, config)
│       └── business-aggregate/ # adapters implementing other modules' ports
├── presentation/http/
│   ├── <name>.controller.ts # thin controllers
│   ├── requests/            # Zod request DTOs (createZodDto)
│   └── responses/           # Id + per-endpoint web/mobile Zod response DTOs
├── public/
│   ├── contracts/           # plain reference shapes
│   ├── ports/               # abstract-class port exported to consumers
│   └── (no barrel index required; consumers import specific path)
└── <module>.module.ts       # NestJS composition root
```

## Dependency direction (ESLint-enforced)

- `platform/**` may not import `@business/**`.
- Business modules import only: `@platform` tokens via `imports: [PlatformModule]`,
  another module's `public/**` or `application/outbound-ports/**`, and
  `shared-business` primitives.
- Domain folders import no `@nestjs/*`.
- Raw clients (Prisma, amqplib, kafkajs, ioredis, ...) → `infrastructure/config/bootstrap/platform` only.
- Hand-written `$queryRaw` must use PHYSICAL column names (platform tables are
  not uniform: `outbox_messages`, `inbox_messages`, `saga_steps` snake_case;
  rest camelCase).
- Side effects leaving the process go through `OutboxWriterPort` inside
  `@Transactional()` — never publish from a use case.
- `business/**` may never import `@infrastructure/**`.

## Use case anatomy

- Command use cases: `@Injectable()` with `execute(input)`, annotated
  `@Transactional()`. Orchestrate module ports, cross-module calls via outbound
  ports, build/call aggregate via factory, persist via command repository port,
  drain `pullEvents()` and append to integration port (outbox, same transaction).
- Query use cases: read-only; skip aggregate/outbox; go through query repository
  port bound to Prisma using `PrismaReadPort` (replica).
- Controllers call use cases directly (no inbound-port/mediator layer).

## Cross-module communication

- Through outbound ports resolved via Nest container — modules never import
  each other's internals.
- Consumers implement producer's `public/ports` via adapters under
  `infrastructure/adapters/business-aggregate/` (or `external/`).
- Events: outbox append → scheduler publishes → broker → listener → inbox dedupe
  → use case.

## Ports & adapters

- Command repository port (abstract class = DI token) → Prisma command repo
  using `TransactionHost`.
- Query repository port → Prisma query repo using `PrismaReadPort`.
- Integration port (e.g. `PurchaseOrderIntegrationPort`) → `OutboxAdapter`
  → `OutboxWriterPort`.
- Outbound ports (company config, cross-module) → adapters.

## Platform service structure (canonical for NEW services)

Flat layout: root classes + `events/`, `http/`, `ports/`, `usecases/`,
`adapters/`, `repositories/`. No `domain/`/`application/` folders. One use case
per file; one request DTO per file (zod via `createZodDto`); ports are abstract
classes; providers use `useExisting`; module file contains bindings/exports only;
`@Global()` never used; business opt-in registries bridged by composition root
`src/bootstrap/configure-*.ts`.

## HTTP / validation / errors

Global pipeline (registered in `AppModule`):
- `AppValidationPipe` (nestjs-zod) global APP_PIPE.
- `RequestIdInterceptor` seeds CLS request context.
- `ResponseInterceptor` success envelope `{ status, statusCode, data, message }`.
- `LoggingInterceptor` structured JSON request logging (no bodies).
- `DeviceResponseInterceptor` + `@DeviceResponse`.
- `HttpExceptionsFilter` error envelope.

REST surface under `/api/v1`; Swagger at `/api/docs` (disabled in production).

## Observability & security

- `LoggerPort` (console), `MetricsPort` (Prometheus, `GET /api/v1/metrics`
  `@SkipTenancy()`), `ErrorTrackingPort` (Sentry, no-op without DSN).
- Tenancy: `TENANCY_MODE=single|multi`; `TenancyAuthGuard` registered as APP_GUARD.
- Rate limiting via throttler.

## Testing

- No unit specs in `src/`; `npm test` runs with `--passWithNoTests`.
- E2E suite (`npm run test:e2e`) needs `docker compose up -d` + `.env`.
- Covers DI graph, error envelope, PO-07 receiving concurrency, `grn.post`
  idempotent replay, cross-tenant isolation, controlled amendment, background
  services (notification, batch, outbox, inventory consumer).
- Test app via `test/utils/create-test-app.ts` applies composition-root bridges.

## Creating a new business module

Copy `src/business/procurement/product` as layout reference. Follow
`docs/BUSINESS-MODULE-GUIDE.md` and target rules in
`docs/architecture/business-modules/ARCHITECTURE-RULES.md`. Where guide/code
differs, target rules govern.

## Commands

See `package.json` scripts and `AGENTS.md` verification battery.
