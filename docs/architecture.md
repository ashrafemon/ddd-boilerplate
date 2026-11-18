# ERP Architecture Reference

See [`docs/Erp Backend Folder Structure.xlsx`](docs/Erp Backend Folder Structure.xlsx) for the complete project structure and detailed file organization reference, including the new **Use Case & Facade Architecture** sheet.

const VARIABLE_PATTERN = /\{\{\s*([\w.]+)\s*\}\}/g;

/**

- Pure (version, model) -> subject/body function. Deterministic,
- provider-agnostic, no side effects — knows nothing about a channel or
- provider. Interpolates `{{key}}`/`{{a.b}}` placeholders against the flat
- model; a missing key renders as an empty string rather than throwing, so a
- template author's typo fails a lint pass, not a recipient's send.
  */
  @Injectable()
  export class TemplateRenderer {
  render(version: NotificationTemplateVersion, model: TemplateModel): RenderedTemplate {
  return {
  subject: version.subject ? TemplateRenderer.interpolate(version.subject, model) : undefined,
  body: TemplateRenderer.interpolate(version.body, model),
  };
  }
  }

export class TemplateRendererUtils {
static interpolate(source: string, model: TemplateModel): string {
return source.replace(VARIABLE_PATTERN, (_match, path: string) => {
const value = TemplateRendererUtils.resolvePath(model, path);
return TemplateRendererUtils.formatValue(value);
});
}

static formatValue(value: unknown): string {
if (value === undefined || value === null) {
return '';
}
if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
return String(value);
}
if (value instanceof Date) {
return value.toISOString();
}
return JSON.stringify(value);
}

static resolvePath(model: TemplateModel, path: string): unknown {
return path.split('.').reduce<unknown>((acc, key) => {
if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
return (acc as Record<string, unknown>)[key];
}
return undefined;
}, model);
}
}

/**

- Prisma-backed audit trail. All DB access goes through the TransactionHost
- so audit rows commit atomically with the business change. Request/correlation
- ids and tenant/organization scope are filled from `RequestContextPort` when
- the caller does not provide them.
  */
  @Injectable()
  export class PrismaAuditRepository implements AuditPort {
  constructor(
  private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
  private readonly requestContext: RequestContextPort,
  ) {}

public async record(entry: AuditEntry): Promise<void> {
const context = this.requestContext.get();
await this.txHost.tx.auditLog.create({
data: {
action: entry.action,
entityType: entry.entityType,
entityId: entry.entityId,
changes: (this.redact(entry.changes) as object) ?? undefined,
actorId: entry.actorId ?? context?.userId,
actorType: entry.actorType ?? (context?.userId ? 'user' : 'system'),
tenantId: entry.tenantId ?? this.requestContext.getTenantId(),
companyId: entry.companyId ?? this.requestContext.getCompanyId(),
requestId: this.requestContext.getRequestId(),
correlationId: this.requestContext.getCorrelationId(),
},
});
}

private redact(changes?: Record<string, unknown>): Record<string, unknown> | undefined {
if (!changes) {
return undefined;
}
const out: Record<string, unknown> = {};
for (const [key, value] of Object.entries(changes)) {
out[key] = SENSITIVE_KEYS.test(key) ? '[redacted]' : AuditUtils.truncate(value);
}
return out;
}
}

const SENSITIVE_KEYS = /(password|secret|token|authorization|pin|otp)/i;
const MAX_FIELD_JSON = 4_000;

export class AuditUtils {
static truncate(value: unknown): unknown {
if (value === null || typeof value === 'number' || typeof value === 'boolean') {
return value;
}
const text = typeof value === 'string' ? value : AuditUtils.safeStringify(value);
return text.length > MAX_FIELD_JSON ? `${text.slice(0, MAX_FIELD_JSON)}…[truncated]` : value;
}

static safeStringify(value: unknown): string {
try {
return JSON.stringify(value) ?? String(value);
} catch {
return String(value);
}
}
}

Module aliases: `@config/*`, `@common/*`, `@bootstrap/*`, `@infrastructure/*`,
`@platform/*`, `@business/*`, `@test/*`, `@prisma/client` → `src/generated/client.ts`

## Layers

### `config/`

Owns every environment variable. Typed `registerAs` blocks loaded by `@Global` ConfigModule;
`ConfigService` is a typed facade — adapters use `getPostgres()`, `getRabbitMQ()`, etc.
Raw `process.env` access is confined to the shared `env.util` helpers (`ensureEnvLoaded`,
`numericEnv` in `@common`) — config blocks and bootstrap call those, never raw env reads.
Opt-in client flags (`SECRETS_MANAGER_ENABLED`, `PUPPETEER_ENABLED`, `OTEL_TRACING_ENABLED`, …)
live here too.

### `common/`

Only primitives with consumers in MORE THAN ONE layer (business + platform, or
config + bootstrap + platform). Currently:

- `application/types/` — `pagination`, `api-response`, `wire-date`, `json-value`,
  `device-context` (wire-format types shared across HTTP boundaries);
- `application/utils/` — `tenant-scope` (assert-visible rule), `env.util` (env loading +
  fail-fast parsing used by config, bootstrap and platform constants);
- `application/exceptions/` — `infrastructure.exception` (the shared failure marker thrown
  by infrastructure clients; standalone, extends `Error` — common never imports platform);
- `http/` — framework plumbing wired once in `AppModule`/bootstrap: exception filter,
  `RbacGuard` + `@Rbac()`, throttler guard, interceptors (request-id, logging, response,
  device), validator pipe, `CompanyConfigContextMiddleware`, decorators (`@KafkaEvent`,
  device decorators, `@SkipTenancy`).

NOT here (moved to their owners): company identity → `platform-common/context`;
domain errors → `platform-common/errors`; registry base class → `platform-common/registry`;
Prisma JSON helpers → `platform-common/persistence`; single-consumer helpers (chunker,
json-value schema) → their consuming platform capability. Nothing platform-only or
config-only may be added here.

### `bootstrap/`

Only what the NestJS application needs to run: env loading, Sentry, tracing, NestFactory,
security, CORS, HTTP prefix/versioning, shutdown hooks, Swagger, server, and
`CompanyConfigContextMiddleware` registration. All env/conditional values come from the
`@config` facades — bootstrap never reads `process.env` directly.

### Opt-in registries (decorator + DiscoveryService)

Business adapters plug into platform registries declaratively — no composition-root
bridges. A business adapter class is decorated (`@BatchOperationOptIn()`,
`@ImportOptIn({entityKey, descriptor})`, stackable `@NotificationOptIn({notificationType,
channels, priority, eventName?})`, `@WebhookEventTypeOptIn(name)`,
`@WebhookInboundSourceOptIn({source, verify})`); the owning platform capability module
scans the DI graph at `onApplicationBootstrap` (DiscoveryService) and registers every
decorated instance. Adapters stay pure (no registry imports, no lifecycle); duplicates
still throw at boot. Adding an opt-in = decorate the adapter — nothing else.

### `infrastructure/`

Third-party client initialization only. One folder per client, flat — no grouping
subfolders (`database/`, `messaging/`, … are banned). Each client folder carries its own
module; `infrastructure.module.ts` imports/exports every client module directly.

```
infrastructure/
├── prisma/       prisma.module + write/read client services (pool init, health probe, teardown)
├── redis/        redis.module + RedisService (client init, retry policy, shutdown)
├── rabbitmq/     rabbitmq.module (forRootAsync) + config factory
├── kafka/        kafka.module + kafka.service (client init, producer/consumer ops)
├── sqs/          sqs.module (registerAsync) + config factory
├── ses/          ses.module + ses.service (client init only)
├── sns/          sns.module + sns.service (client init only)
├── s3/           s3.module + s3.service (client init + boot probe only)
├── bullmq/       bullmq.module (forRootAsync, options inline)
├── secrets/      secrets.module + secrets.service (opt-in, ListSecrets boot probe)
├── puppeteer/    puppeteer.module + puppeteer.service (opt-in, lazy shared browser)
├── cache-manager/ cache-manager.module + service (HTTP response cache, boot probe)
├── context/      context.module (CLS + transactional plugin setup)
└── infrastructure.module.ts   imports/exports every client module
```

**What belongs here — and nothing else:**

- client construction from the typed config facade (`@config`), never raw `process.env`;
- a boot-time reachability probe in `onModuleInit` (fail-closed in production:
  unreachable/missing config throws `InfrastructureException`; lenient in dev: warn +
  disabled state via an `isEnabled` getter);
- teardown in `onModuleDestroy` **only for clients that own persistent connections**
  (Prisma pools, Redis, Kafka). Stateless HTTP SDK clients (SES, SNS) have no lifecycle
  hooks; RabbitMQ/BullMQ manage their own connections;
- small getters exposing the client/config pieces platform adapters need
  (e.g. `S3Service.client`, `bucketName`).

**What must NOT live here:** object/message operations, ports, adapters, business logic.
Operations belong in platform adapters, which import the raw SDK commands themselves
(e.g. `S3FileStorageAdapter` issues `PutObjectCommand` against `S3Service.client`).
Client-level operations that keep a raw-client type inside infrastructure (e.g.
`KafkaService.startConsumer` hiding kafkajs types) are the exception — use them when
ESLint bans the raw import in platform.

Deliberately NOT `@Global()` (only CLS is global, the library requires it). Outbox/Inbox
live as directories under platform, wired by `PlatformModule`, to avoid the cycle
`OutboxModule → ContextModule → InfrastructureModule`.

**Adding a new client — checklist:**

1. `src/infrastructure/<client>/` — flat, one folder.
2. `<client>.service.ts` — client construction + boot probe + teardown (only if it owns
   connections) + getters. No operations.
3. `<client>.module.ts` — provides/exports the service; long option builders may stay a
   plain factory function only when they carry real logic (trivial ones go inline in the
   module).
4. Register in `infrastructure.module.ts` (imports + exports).
5. Operations → a platform adapter behind a port (`platform/platform-common/<capability>/`),
   which imports the client module and the SDK commands it needs.
6. Add a probe to `HealthCheckAdapter` (`platform/platform-common/health/`) so the client
   shows up in `GET /api/v1/health`.
7. Config → typed facade in `src/config/` + `.env.example`; fail-closed in production.

### `platform/`

Services built on infrastructure clients, exposed as **ports**. `PlatformModule` imports and
re-exports all sub-modules (not `@Global`). Each business module lists `imports: [PlatformModule]`.

Key ports: `OutboxWriterPort`, `InProcessEventBus`, `MessageQueuePort`, `InboxPort`,
`RequestContextPort`, `DistributedLockPort`, `IdempotencyPort` + `@Idempotent()`,
`NumberingPort`, `AuditPort`, `CompanyConfigPort`, `CachePort`,
`NotificationDispatchPort`, `LoggerPort`/`MetricsPort`/`ErrorTrackingPort`,
`FileStoragePort`, `HealthPort`, `AuthenticationPort`, `RbacPort`, `AbacPort`.

### `business/`

`shared-business/` holds framework-independent primitives. Aggregates under `party/`,
`procurement/`, `sales/`, aggregated by `BusinessModule`. May never import `@infrastructure`.

## Dependency direction (ESLint-enforced)

```
Controller → Use Case → Domain + Factory → Command Repository Port → Prisma (TransactionHost)
Use Case → Outbound Ports → Producer Facade → Query Use Case → Query Port → PrismaReadPort
Use Case → Integration Port → OutboxAdapter → OutboxWriterPort → outbox_messages
OutboxScheduler → PublishPendingBatch → MessageQueuePort → RabbitMQ/Kafka/SQS
OutboxScheduler → InProcessEventBus.emit → in-process listeners
```

### Import rules

| From              | May import                                                                                                                                 | May not import                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| `infrastructure`  | clients + `@config` + `@common` (`InfrastructureException`, env.util)                                                                      | —                                                        |
| `platform`        | infrastructure clients ONLY                                                                                                                | `@business/**` (ANY)                                     |
| `business module` | own internals, `@platform` ports, `@common` primitives, `shared-business`, another module's `public/**` or `application/outbound-ports/**` | `@infrastructure/**`, another module's internals         |
| `shared-business` | framework-independent primitives only                                                                                                      | `@platform/**`, `@infrastructure/**`, `@business/*/*/**` |

## Ports & adapters

Every port is an abstract class used as its own DI token; modules bind with `useClass`/`useExisting`.

Per aggregate: `*CommandRepository` (domain), `*Query` (application/queries), `*IntegrationPort`
(application/integrations/publishes), `CompanyConfigPort` (application/outbound-ports).

Use cases inject the abstract class; the module binds the concrete adapter.

## Business module anatomy

```
business/<context>/<module>/
├── domain/        aggregates, entities, value-objects, events, policies, factories,
│                  repositories, types
├── application/   usecases, queries, facades, outbound-ports,
│                  integrations/publishes, integrations/listeners
├── infrastructure/
│   ├── persistence/prisma/   # repos + mappers
│   └── adapters/             # platform + module adapters
├── presentation/http/
│   ├── <name>.controller.ts  # thin, calls use cases directly
│   ├── requests/             # Zod request DTOs (createZodDto)
│   └── responses/            # web/mobile Zod response DTOs
├── public/
│   ├── contracts/, ports/, index.ts   # only folder other modules may import
└── <module>.module.ts        # bindings/exports only
```

### Command use case pattern

1. Read context from `RequestContextPort` (CLS) — never inject `AuthenticationPort` or
   `CompanyConfigPort` directly.
2. Call `AbacPort.evaluate()` before business steps.
3. Orchestrate factory → aggregate → repository port → outbox.
4. `@Transactional()` on `execute()`.

### Aggregate list

| Context     | Module            | Aggregate       | Natural key (unique per company) |
| ----------- | ----------------- | --------------- | -------------------------------- |
| party       | vendor            | Vendor          | code                             |
| procurement | product           | Product         | sku                              |
| procurement | purchase-order    | PurchaseOrder   | orderNumber                      |
| procurement | good-receipt-note | GoodReceiptNote | grnNumber                        |
| sales       | invoice           | Invoice         | invoiceNo                        |

## Tenancy

Every business table carries `tenantId`/`companyId`, stamped from request context on create,
filtered on every read/write. Foreign row = 404 (never 403). Natural key unique within company,
not globally. Two companies each have `PO-00000001`.

## Authentication / Authorization / Tenancy

### Tenancy modes

- `single` (default): `x-tenant-id`/`x-company-id` headers trusted (dev/internal/verified gateway).
- `multi`: JWT required with `tenantId` claim; raw headers ignored; anonymous rejected
  (except `@SkipTenancy()` routes).

### CLS RequestContext

Fields: `requestId`, `correlationId`, `tenantId`, `companyId`, `userId`, `roles`, `locale`,
`ip`, `userAgent`, `defaultCurrency`, `autoApproveThreshold`, `overReceiptTolerance`.

### Middleware

`CompanyConfigContextMiddleware` reads `x-company-id`, resolves `CompanyConfigPort`, stamps
company config fields into CLS `RequestContext`. Runs before route handlers.

### Interceptor

`RequestIdInterceptor` generates `requestId`/`correlationId`, seeds CLS via
`RequestContextPort.set()` (merge, preserves company config fields).

### Guards

- `TenancyAuthGuard` (global `APP_GUARD`): enforces tenancy boundary.
- `RbacGuard` (global `APP_GUARD`): reads `@Rbac()` metadata, resolves `userId` from CLS,
  calls `RbacPort.can()`.

### Decorator

`@Rbac(resource, action)` on route handlers.

### ABAC (usecase level)

Every command use case calls `AbacPort.evaluate()` with CLS-derived context before business
steps. `AbacResult` = `{ decision: 'ALLOW' | 'DENY', scopeFilter?, reason? }`.

### No-op adapters (IAM deferred)

`AuthenticationPort` → returns `null`; `RbacPort` → returns `true`; `AbacPort` → returns
`{ decision: 'ALLOW', scopeFilter: {} }`. Bound via `useExisting` in `AuthenticationModule`/
`AuthorizationModule`. Replace with real implementations when IAM is built.

## Outbox, events & messaging

State-changing use cases run `@Transactional()` and append domain events to the outbox in the
same DB transaction:

```
use case → <Aggregate>IntegrationPort → OutboxAdapter → OutboxWriterPort → outbox_messages
```

`OutboxScheduler` ticks, claims due `PENDING` rows via `FOR UPDATE SKIP LOCKED`, publishes to
`MessageQueuePort`, emits on `InProcessEventBus`, CAS-settles. Statuses: `PENDING` /
`PUBLISHED` / `DEAD_LETTER`. At-least-once delivery; consumers dedupe on `event-id`.

Canonical envelope: `eventId`, `eventType`, `aggregateType`, `aggregateId`, `payload`,
`headers` (`event-id`, `correlation-id`, `causation-id`, `tenant-id`, `broker`), `occurredAt`.

Broker picked by `envelope.broker` (default `rabbitmq`). RabbitMQ → topic exchange `erp.events`;
Kafka → topic = event type; SQS → configured queue.

Listeners in `application/integrations/listeners/`: `*.rabbitmq.listener-event.ts`,
`*.kafka.listener-event.ts`, `*.sqs.listener-event.ts`, `*.event-emitter.listener-event.ts`.
Handlers delegate to use cases/facades — never inline business logic.

## Data model

Prisma schema split per context under `prisma/schema/<context>/`, aggregated by
`prisma/schema/schema.prisma`. **Migrations are the source of truth** — every schema edit ships with a
`prisma/migrations/<timestamp>_<name>` folder (`npm run db:migrate`); `npm run db:migrate:deploy` applies
them and CI fails when the migrated database drifts from `prisma/schema`;
`npx prisma generate` regenerates client to `src/generated/`.

Physical column names not uniform: `outbox_messages`, `inbox_messages`, `saga_steps` are
snake_case; the rest camelCase. Hand-written `$queryRaw` must use physical column names.

## Verification battery (run after any change)

```bash
npx tsc --noEmit -p tsconfig.json
npm run lint:check
npm run format:check
npm run docs:di
npm run build
NODE_ENV=test node -e "(async()=>{const{NestFactory}=require('@nestjs/core');const{AppModule}=require('./dist/app.module.js');const a=await NestFactory.create(AppModule,{preview:true});await a.init();await a.close();})()"
```

## Commands

| Command                 | Purpose                                     |
| ----------------------- | ------------------------------------------- |
| `npm run start:dev`     | watch mode dev server                       |
| `npm run build`         | compile to `dist/`                          |
| `npm run lint`          | ESLint + architecture rules (`--fix`)       |
| `npm run lint:check`    | ESLint + architecture checks                |
| `npm run format:check`  | prettier                                    |
| `npm test`              | unit tests (`--passWithNoTests`)            |
| `npm run test:e2e`      | e2e smoke (requires `docker compose up -d`) |
| `npm run db:migrate`    | create a migration from a schema change     |
| `npm run db:migrate:deploy` | apply committed migrations (prod/CI)    |
| `npm run db:push`       | sync a throwaway local DB only              |
| `npm run db:generate`   | regenerate Prisma client                    |
| `npm run db:seed`       | seed products/vendors                       |
| `npm run docs:di`       | regenerate DI wiring docs                   |
| `npm run prisma:studio` | Prisma Studio UI                            |

## Open work

- **IAM / Auth deferred**: RBAC/ABAC ports exist with no-op adapters; real implementation pending.
- **Optimistic concurrency**: implemented on PurchaseOrder and GRN only; Vendor/Product/Invoice
  command repos are last-write-wins.

## Commit hygiene

- Do not commit secrets or `.env`.
- Never edit `src/generated/**`.
- Public contracts change only with explicit owner approval.
- Commit only when explicitly requested.
