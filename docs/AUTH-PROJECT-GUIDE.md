# Authentication Project — Build Guide for AI Agents

> **Audience:** an AI coding agent (or engineer) that must scaffold and implement a **new
> standalone Authentication service** from scratch.
> **Method:** copy the *architecture, layering, coding conventions and platform capabilities* of the
> reference ERP boilerplate (this repo), but replace the ERP business domain with an
> **Authentication / Identity business domain**, and keep only the **auth-relevant platform
> modules**.
>
> This document is the single source of truth. Read it fully before writing code. When this guide
> and habit disagree, this guide wins. When this guide is silent, follow the reference repo's
> `docs/architecture.md`, `docs/platform-standard.md` and `docs/testing-business-modules.md`.

---

## 0. TL;DR for the agent

- **Shape:** NestJS 11 + TypeScript (strict) + Prisma 7 + PostgreSQL. DDD / Hexagonal modular
  monolith. Business (`src/business`) → Platform ports (`src/platform`) → Infrastructure clients
  (`src/infrastructure`).
- **Goal:** a production-oriented **Authentication & Identity** backend: registration, login,
  JWT access + refresh, logout, OTP/MFA, password reset, email verification, sessions/devices,
  account lockout, invitations, RBAC, tenant/company isolation, audit, notifications, background
  jobs and scheduled tasks.
- **What to keep from the reference repo:** the *entire architecture*, the coding conventions, the
  verification battery, and a **minimal auth-focused platform subset** (see §4).
- **What to drop:** all ERP business modules (party, procurement, sales, product), and the
  platform modules unrelated to auth (saga, billing, tax, AI, organization, import/export,
  webhook, file-management, etc.).
- **Build order:** §12 (phased). Do not write all files at once; follow the phases and run the
  verification battery (§11) after each.

---

## 1. Reference mapping (this repo → new project)

| Concern | Reference repo (this project) | New Authentication project |
| --- | --- | --- |
| Business domain | ERP aggregates (`vendor`, `product`, `purchase-order`, `invoice`) | **Auth aggregates** (`user`, `account`, `session`, `credential`, `role`, `permission`, `organization`) |
| Platform layer | Full platform (saga, billing, tax, AI, org, …) | **Minimal auth-focused platform** (§4) |
| Infrastructure | prisma, redis, rabbitmq, bullmq, ses, sns, s3, secrets, puppeteer, cache-manager, context | **Same client set minus unused** (drop `s3`, `puppeteer`, `sns` if no SMS/push; keep `ses` for email) |
| Config | `src/config/*.config.ts` typed facades | Same pattern, auth-focused config set (§7) |
| Common | `src/common` shared primitives | Same pattern (§6) |
| Verification | battery in §11 | Identical battery |

> The new project is a **fresh repository**. Copy *patterns and file shapes*, not the ERP files.

---

## 2. Tech stack & dependencies (target)

- **Runtime:** Node.js ≥ 20.10, npm ≥ 10.
- **Framework:** `@nestjs/core` 11, `@nestjs/common`, `@nestjs/config`, `@nestjs/jwt`,
  `@nestjs/throttler`, `@nestjs/bullmq` (BullMQ), `@nestjs/schedule`, `nestjs-pino`,
  `@nestjs/swagger`.
- **Prisma:** `prisma` 7 + `@prisma/client` 7 with the driver adapter (`prisma.config.ts`), client
  generated to `src/generated/`.
- **Validation:** `zod` + `nestjs-zod` (`createZodDto`).
- **Security:** `bcrypt`/`argon2` (password hashing), `crypto` (OTP, tokens, hashing).
- **Messaging:** `amqplib` via the platform `MessagingModule` (RabbitMQ).
- **Cache/Lock:** `ioredis` via `RedisService`.
- **CLS/Transactions:** `nestjs-cls` + `@nestjs-cls/transactional`.
- **Docs:** Swagger at `/api/docs`.

Keep versions aligned with the reference `package.json`.

---

## 3. Repository layout (target tree)

```
auth-service/
├── prisma/
│   ├── schema/
│   │   ├── schema.prisma                # aggregates models; imports domain files
│   │   ├── auth/user.prisma
│   │   ├── auth/credential.prisma
│   │   ├── auth/session.prisma
│   │   ├── auth/otp.prisma
│   │   ├── auth/organization.prisma
│   │   ├── auth/role.prisma
│   │   ├── auth/permission.prisma
│   │   └── platform/<capability>.prisma  # outbox, inbox, idempotency, audit, scheduler, notification
│   ├── migrations/                      # source of truth; commit with schema
│   └── seed.ts
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── bootstrap/                       # NestFactory, security, CORS, swagger, shutdown
│   ├── config/                          # typed registerAs facades (§7)
│   ├── common/                          # cross-layer primitives (§6)
│   ├── infrastructure/                  # client init only, one folder per client (§5)
│   ├── platform/                        # auth-focused capabilities (§4)
│   ├── business/                        # auth domain modules (§8)
│   │   ├── shared-business/             # framework-independent primitives
│   │   ├── identity/                    # context: organization, user, credential
│   │   ├── access/                      # context: session, token, otp, mfa
│   │   └── governance/                  # context: role, permission, audit-facing
│   └── specifications/                  # cross-cutting tests, fakes, utils (§11)
├── docs/
│   ├── AUTH-PROJECT-GUIDE.md            # this file
│   └── auth-design.md                   # the product/auth feature spec (your attachment)
├── .env.example
├── docker-compose.yml                   # postgres, redis, rabbitmq
├── package.json
└── tsconfig.json
```

Path aliases (`tsconfig.json`):

```jsonc
"@config/*":         ["src/config/*"],
"@common/*":         ["src/common/*"],
"@bootstrap/*":      ["src/bootstrap/*"],
"@infrastructure/*": ["src/infrastructure/*"],
"@platform/*":       ["src/platform/*"],
"@business/*":       ["src/business/*"],
"@test/*":           ["src/specifications/*"],
"@prisma/client":    ["src/generated/client.ts"]
```

---

## 4. Platform layer (minimal, auth-focused)

Copy the **file shapes and port/adapter anatomy** from the reference `src/platform/**`. Keep **only**
these capabilities. Delete everything else.

### 4.1 Keep

| Group | Capability | Path | Why |
| --- | --- | --- | --- |
| platform-common | **context** | `platform/platform-common/context/` | CLS `RequestContextPort` — mandatory; every use case reads it |
| platform-common | **authentication** | `platform/platform-common/authentication/` | `AuthenticationPort` (identity resolution); **implement it for real** here (JWT verify) |
| platform-common | **identity** | `platform/platform-common/identity/` | `IdentityPort` — user/organization lookups |
| platform-organization | **authorization** | `platform/platform-organization/authorization/` | `RbacPort`, `AbacPort` — implement real RBAC/ABAC (or keep no-op as seam) |
| platform-common | **tenancy** | `platform/platform-common/tenancy/` | `TenancyAuthGuard`, `TenancyPort`; JWT trust boundary |
| platform-common | **outbox** | `platform/platform-common/outbox/` | `OutboxWriterPort` + `OutboxScheduler` (events) |
| platform-common | **inbox** | `platform/platform-common/inbox/` | consumer dedupe |
| platform-common | **messaging** | `platform/platform-common/messaging/` | `MessageQueuePort` / `MessageConsumerPort` (RabbitMQ) |
| platform-common | **events** | `platform/platform-common/events/` | in-process event bus |
| platform-common | **scheduler** | `platform/platform-common/scheduler/` | cron/interval jobs (token cleanup, session expiry, password-expiry reminders) |
| platform-common | **notification** | `platform/platform-common/notification/` | email/OTP/push delivery (SES/SNS channels) |
| platform-common | **background-jobs** | `platform/platform-common/background-jobs/` | queue-backed async work (`BackgroundJobsPort`) |
| platform-common | **locking** | `platform/platform-common/locking/` | distributed lock (login throttling, OTP send dedupe) |
| platform-common | **idempotency** | `platform/platform-common/idempotency/` | `@Idempotent()` on mutating routes |
| platform-common | **cache** | `platform/platform-common/cache/` | `CachePort` (token denylist, rate-limit counters) |
| platform-common | **audit** | `platform/platform-common/audit/` | `AuditPort` — security-relevant events (login, logout, reset) |
| platform-common | **numbering** | `platform/platform-common/numbering/` | (optional) human ids if needed |
| platform-common | **health** | `platform/platform-common/health/` | `GET /api/v1/health` |

### 4.2 Drop

`saga`, `saga-outbox`, `saga-inbox`, `billing`, `tax`, `currency-conversion`,
`document-generation`, `export`, `import`, `webhook`, `file-management`, `recurring`,
`batch-operation`, `condition-engine`, `data-retention`, `event-sourcing-store`, `feature-flag`,
`secret-management`, `subscription`, `governance`, `rate-limitting`, `integration`,
`platform-ai/*`, and most of `platform-organization/*` except `authorization` (and optionally
`configuration`, `organization` if your design needs them).

### 4.3 PlatformModule

`src/platform/platform.module.ts` imports and re-exports **only the kept modules**. Never
`@Global()` (only CLS is global). Business modules add `imports: [PlatformModule]`.

### 4.4 Auth-specific platform implementations (replace the no-ops)

The reference repo ships **no-op adapters** for `AuthenticationPort`, `RbacPort`, `AbacPort`
(IAM deferred). In the new project these become **real**:

- `AuthenticationPort` → `JwtAuthenticationAdapter`: verify `Authorization: Bearer <jwt>` with
  `JWT_ACCESS_SECRET`, return `Identity { userId, tenantId, companyId, roles }`. (The
  `TenancyAuthGuard` already does JWT verification — reuse that seam, see §7.4.)
- `RbacPort.can()` → check `userId` roles/permissions against the required resource+action.
- `AbacPort.evaluate()` → attribute checks (tenant/company scope, ownership) returning
  `{ decision, scopeFilter?, reason? }`.

> Keep the port **abstract classes** as DI tokens. Bind concrete adapters with
> `{ provide: <Port>, useExisting: <Adapter> }`.

---

## 5. Infrastructure layer (one folder per client, flat)

Copy `src/infrastructure/**` file shapes. **Initialization only** — client construction from the
typed `@config` facade, a boot reachability probe in `onModuleInit`, getters. No ports, no
adapters, no business logic.

Keep:

```
infrastructure/
├── prisma/          # PrismaService (read/write clients, pool init, health probe, teardown)
├── redis/           # RedisService (client init, retry policy, isEnabled, shutdown)
├── rabbitmq/        # RabbitMQModule (amqplib connection, channel)
├── bullmq/          # BullMQModule (forRootAsync, queue options)
├── ses/             # SesService (email sending client init; keep for notifications)
├── sns/             # SnsService (optional; SMS/push — drop if unused)
├── secrets/         # SecretsManagerService (opt-in)
├── cache-manager/   # HTTP response cache (opt-in)
├── context/         # CLS + transactional plugin setup (global)
└── infrastructure.module.ts   # imports/exports every client module
```

Drop `s3/` and `puppeteer/` unless your auth design needs document/attachment generation.

Rules (from reference `docs/architecture.md` §infrastructure):

1. One flat folder per client, named after the **client** (`ses`, not `email`).
2. Each folder has its own module; `infrastructure.module.ts` imports/exports each.
3. No operations/ports/adapters here.
4. Teardown only for clients owning persistent connections (Prisma, Redis).
5. Fail-closed in production (`InfrastructureException` when unreachable); lenient in dev
   (`isEnabled` getter).
6. Register each client in `HealthCheckAdapter`.

---

## 6. `src/common` (cross-layer primitives)

Only primitives consumed by **more than one layer**:

```
common/
├── application/
│   ├── types/         # pagination, api-response, wire-date, json-value,
│   │                  # device-context, verified-identity (cross-layer)
│   ├── utils/         # tenant-scope (assert-visible), env.util
│   └── exceptions/    # infrastructure.exception
└── http/              # exception filter, RbacGuard + @Rbac(), throttler guard,
                       # interceptors (request-id, logging, response, device),
                       # validator pipe, CompanyConfigContextMiddleware, @SkipTenancy()
```

`verified-identity.ts` is the wire contract between the tenancy guard and the CLS interceptor:

```ts
export const VERIFIED_IDENTITY_REQUEST_KEY = 'verifiedIdentity';
export interface VerifiedIdentity {
  tenantId?: string;
  companyId?: string;
  userId?: string;
  roles: string[];
}
```

---

## 7. Config (`src/config`)

Typed `registerAs` facades loaded by a `@Global` `ConfigModule`. **No raw `process.env` outside
`env.util`.** Each client reads config through the typed `ConfigService` facade.

Minimal config set:

| File | Owns |
| --- | --- |
| `app.config.ts` | port, global prefix, env (`isProduction`) |
| `database.config.ts` | Postgres URL, pool |
| `auth.config.ts` | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`, `PEPPER`, `ARGON2_*` |
| `security.config.ts` | tenancy mode (`single`/`multi`), CORS, throttler, bcrypt rounds, lockout thresholds, OTP TTL/length |
| `messaging.config.ts` | RabbitMQ URL, exchange, prefetch |
| `redis.config.ts` | Redis URL, TTLs |
| `notification.config.ts` | SES/SNS config, from-address, retry |
| `scheduler.config.ts` | poll interval, batch, lease |
| `outbox.config.ts` / `inbox.config.ts` / `idempotency.config.ts` / `locking.config.ts` | intervals, retention, TTLs |
| `observability.config.ts` | pino level, sentry/otel flags |
| `http-cache.config.ts` | `HTTP_CACHE_ENABLED` |
| `secrets.config.ts` | secrets manager flag |

### 7.4 Auth/tenancy flow (reuse the reference seam)

- `TenancyAuthGuard` (global `APP_GUARD`, from `platform-common/tenancy/http/`) verifies the JWT
  when `TENANCY_MODE=multi`, stashes `VerifiedIdentity` on the request under
  `VERIFIED_IDENTITY_REQUEST_KEY`, rejects missing/invalid tokens (401/403), honors `@SkipTenancy()`
  (login/register/refresh/verify routes).
- `RequestIdInterceptor` reads the stashed identity and seeds CLS via `RequestContextPort.set()`.
- `RbacGuard` (global `APP_GUARD`) reads `@Rbac(resource, action)` metadata, resolves `userId` from
  CLS, calls `RbacPort.can()`.
- Command use cases call `AbacPort.evaluate()` with CLS-derived context before business steps.

---

## 8. Business layer (Authentication domain)

### 8.1 Bounded contexts & aggregates

```
business/
├── shared-business/                 # framework-independent primitives
│   └── domain/
│       ├── bases/                   # AggregateRoot, Entity base
│       └── common/value-objects/    # Money-like shared VOs (Email, etc.)
├── identity/
│   ├── organization/                # Organization (tenant/company) aggregate
│   ├── user/                        # User aggregate
│   └── credential/                  # Credential (password hash) — child of User
├── access/
│   ├── session/                     # Session / device aggregate
│   ├── token/                       # RefreshToken, VerificationToken
│   └── otp/                         # OtpChallenge (login MFA, reset, verify)
└── governance/
    ├── role/                        # Role aggregate
    └── permission/                  # Permission (RBAC)
```

Each aggregate follows the reference **business module anatomy** (see §8.2) and the reference
`docs/generate-business-module.md`.

### 8.2 Business module anatomy (per aggregate)

```
business/<context>/<module>/
├── domain/
│   ├── aggregates/<module>.aggregate.ts
│   ├── aggregates/<module>.invariants.ts
│   ├── entities/<child>.entity.ts
│   ├── value-objects/<name>.vo.ts
│   ├── value-objects/<name>.invariants.ts
│   ├── events/<module>.<event>.event.ts
│   ├── policies/<name>.policy.ts
│   ├── factories/<module>.factory.ts
│   ├── repositories/<module>-command.repository.ts   # abstract class DI token
│   └── types/<module>.types.ts
├── application/
│   ├── usecases/<verb>-<noun>.usecase.ts
│   ├── queries/<module>.query.ts                    # abstract class DI token
│   ├── facades/<module>-for-<consumer>.facade.ts
│   ├── outbound-ports/<name>.port.ts
│   └── integrations/
│       ├── publishes/<module>.publisher-port.ts
│       └── listeners/                               # event consumers
├── infrastructure/
│   ├── persistence/prisma/prisma-<module>-command.repository.ts
│   ├── persistence/prisma/prisma-<module>-query.repository.ts
│   ├── persistence/prisma/prisma-<module>.mapper.ts
│   └── adapters/
│       ├── platform/company-config.adapter.ts
│       └── platform/outbox.adapter.ts
├── presentation/http/
│   ├── <module>.controller.ts
│   ├── requests/<name>.request.dto.ts               # createZodDto
│   └── responses/<name>.<web|mobile>.response.dto.ts
├── public/
│   ├── contracts/<module>-for-<consumer>.contract.ts
│   ├── ports/<module>-for-<consumer>.port.ts
│   └── index.ts
└── <module>.module.ts
```

### 8.3 Command use-case template (copy this exactly)

```ts
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { AbacPort } from '@platform/platform-organization/authorization/ports/abac.port';
import { UserCommandRepository } from '../../domain/repositories/user-command.repository';
import { UserFactory } from '../../domain/factories/user.factory';
import { UserPublisherPort } from '../publishes/publishers/user.publisher-port';

@Injectable()
export class RegisterUserUseCase {
  constructor(
    private readonly users: UserCommandRepository,
    private readonly events: UserPublisherPort,
    private readonly requestContext: RequestContextPort,
    private readonly abac: AbacPort,
  ) {}

  @Transactional()
  async execute(input: { email: string; password: string; name: string }): Promise<string> {
    // 1. CLS context (never inject AuthenticationPort / CompanyConfigPort directly)
    const ctx = this.requestContext.require();
    const companyId = ctx.companyId;
    if (!companyId) throw new NotFoundException('Company not found in request context');

    // 2. ABAC before business steps
    const decision = await this.abac.evaluate({
      context: {
        tenantId: ctx.tenantId ?? '',
        companyId,
        userId: ctx.userId ?? '',
        roles: ctx.roles,
        defaultCurrency: ctx.defaultCurrency ?? 'USD',
        autoApproveThreshold: ctx.autoApproveThreshold ?? 0,
        overReceiptTolerance: ctx.overReceiptTolerance ?? 0,
      },
      resource: 'User',
      action: 'create',
    });
    if (decision.decision === 'DENY') {
      throw new ForbiddenException(decision.reason ?? 'ABAC denied');
    }

    // 3. Factory -> aggregate -> repo -> outbox
    const user = UserFactory.create({ email: input.email, password: input.password, name: input.name });
    if (await this.users.findByEmail(user.email)) {
      throw new ConflictException(`User "${user.email}" already exists`);
    }
    await this.users.save(user);
    for (const event of user.pullEvents()) {
      await this.events.send(event, user.id.toString());
    }
    return user.id.toString();
  }
}
```

### 8.4 Controller template (thin)

```ts
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly register: RegisterUserUseCase, /* ... */) {}

  @Post('register')
  @SkipTenancy()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto): Promise<ApiResponse<IdResponse>> {
    const id = await this.register.execute({ ...dto });
    return { data: { id }, message: 'User registered' };
  }
}
```

### 8.5 Request/response DTOs (Zod)

```ts
// presentation/http/requests/register.request.dto.ts
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(200),
});

export class RegisterDto extends createZodDto(registerSchema) {}
```

### 8.6 Module wiring

```ts
@Module({
  imports: [PlatformModule],
  controllers: [UserController],
  providers: [
    RegisterUserUseCase, LoginUserUseCase, /* ... */
    { provide: UserCommandRepository, useClass: PrismaUserCommandRepository },
    { provide: UserQuery, useClass: PrismaUserQueryRepository },
    {
      provide: UserPublisherPort,
      useFactory: (outbox: OutboxWriterPort) => new SharedOutboxAdapter(outbox, 'User'),
      inject: [OutboxWriterPort],
    },
  ],
  exports: [UserForAccessPort], // public ports only
})
export class UserModule {}
```

`BusinessModule` (`src/business/business.module.ts`) composes the context modules:
`imports: [IdentityModule, AccessModule, GovernanceModule]`.

---

## 9. Authentication feature set (default design — adjust to your spec)

Implement these as the baseline. If your attached design changes names/flows, adapt file/class names
but keep the structure.

### 9.1 Aggregates & responsibilities

| Aggregate | Responsibilities |
| --- | --- |
| `Organization` | Tenant/company boundary; natural key `slug`. Owns users, roles, settings. |
| `User` | Identity: email (unique per org), name, status (`PENDING`/`ACTIVE`/`LOCKED`/`DISABLED`), role assignments, `failedLoginAttempts`, `lockedUntil`. Emits `UserRegistered`, `UserActivated`, `UserLocked`, `UserDisabled`. |
| `Credential` | Password hash (argon2/bcrypt), `passwordChangedAt`, `mustChangePassword`. Child of `User`. Never returned by API. |
| `Session` | Refresh-token-backed device session: `refreshTokenHash`, `deviceId`, `userAgent`, `ip`, `expiresAt`, `revokedAt`. Enables "logout everywhere" and device list. |
| `Token` | Short-lived verification/reset tokens (`VerificationToken`, `PasswordResetToken`) hashed at rest, single-use, expiring. |
| `OtpChallenge` | OTP for MFA/login/reset: `codeHash`, `channel` (email/sms), `expiresAt`, `attempts`, `consumedAt`. |
| `Role` | Named role within an org; holds permission set. |
| `Permission` | `resource:action` capability checked by RBAC. |

### 9.2 API surface (REST, prefix `/api/v1`)

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/auth/register` | none | Register a user (+ send verification email) |
| POST | `/auth/login` | none | Email + password → access + refresh tokens (or MFA challenge) |
| POST | `/auth/refresh` | none | Rotate refresh token → new access + refresh |
| POST | `/auth/logout` | bearer | Revoke current session |
| POST | `/auth/logout-all` | bearer | Revoke all sessions for user |
| POST | `/auth/verify-email` | none | Confirm email with token |
| POST | `/auth/resend-verification` | none | Resend verification email (throttled) |
| POST | `/auth/forgot-password` | none | Send password reset token |
| POST | `/auth/reset-password` | none | Set new password with token |
| POST | `/auth/mfa/otp/request` | bearer | Send OTP to email/phone |
| POST | `/auth/mfa/otp/verify` | bearer | Verify OTP → elevate session / complete login |
| GET | `/auth/sessions` | bearer | List my devices/sessions |
| DELETE | `/auth/sessions/:id` | bearer | Revoke a specific session |
| GET | `/auth/me` | bearer | Current identity + roles/permissions |
| POST | `/organizations/:orgId/users/:userId/roles` | RBAC | Assign roles (admin) |
| POST | `/organizations/:orgId/invitations` | RBAC | Invite a user (email) |

### 9.3 Cross-cutting auth rules

- **Passwords:** argon2id (fallback bcrypt); never log; `Credential` value object wraps the hash.
- **Tokens:** access JWT (short TTL, signed with `JWT_ACCESS_SECRET`); refresh token opaque random,
  **stored hashed** in `Session`; rotate on every refresh; reuse detection revokes the session.
- **Lockout:** after N failed logins, `User.lockedUntil = now + window`; login during lock → 423/429.
- **Throttling:** `@Throttle()` on register/login/reset/mfa request (limits in `security.config.ts`).
- **Idempotency:** `@Idempotent()` on token-consuming mutations where retried by clients.
- **Audit:** `AuditPort.record()` for login success/failure, logout, password change, role change,
  lock/unlock, reset (never store raw secrets — redaction is built in).
- **Notifications:** `NotificationHandler` opt-in adapters for `verify-email`, `reset-password`,
  `mfa-otp`, `invitation`, `account-locked`, `new-device-login`. Channels via SES (email) / SNS.
- **Events:** domain events → `OutboxWriterPort` → RabbitMQ (`user.registered`,
  `user.locked`, `session.created`, `password.reset`, ...). Consumers can live in `access`
  (e.g. lockout → notify, expired session → cleanup).
- **Tenancy:** every business table tenant-scoped (`tenantId`/`companyId`); foreign row = **404**,
  never 403; natural key unique within org, not globally.

### 9.4 Background jobs & scheduled tasks (via platform)

| Job | Trigger | Owner |
| --- | --- | --- |
| Purge expired sessions | scheduler cron (hourly) | `access/session` listener calling a use case |
| Purge expired/used tokens & OTPs | scheduler cron (hourly) | `access/token`, `access/otp` |
| Password-expiry reminder | scheduler cron (daily) | `identity/user` → notification |
| Send OTP / email (async) | background job on demand | `notification` worker |
| Account-unlock sweep | scheduler (recompute expired `lockedUntil`) | `identity/user` |
| Audit log retention purge | scheduler (daily) | `platform-common/audit` |

Business modules **register scheduled jobs** by implementing the scheduler's handler opt-in
(decorator + DiscoveryService), never by importing scheduler internals.

---

## 10. Data model (Prisma)

Author per-context schema files under `prisma/schema/<context>/*.prisma`, aggregated by
`prisma/schema/schema.prisma`. **Migrations are the source of truth**: edit schema →
`npm run db:migrate` (creates `prisma/migrations/<ts>_<name>`) → `npx prisma generate`. Commit
both. `npm run db:push` only for throwaway local DBs.

Example (`prisma/schema/auth/user.prisma`):

```prisma
model User {
  id           String   @id @default(uuid()) @db.Uuid
  tenantId     String?  @map("tenant_id") @db.VarChar(100)
  companyId    String?  @map("company_id") @db.VarChar(100)
  email        String
  name         String
  status       String   @default("PENDING")
  failedLogins Int      @default(0) @map("failed_logins")
  lockedUntil  DateTime? @map("locked_until")
  version      Int      @default(1)
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  credential   Credential?
  sessions     Session[]
  roles        UserRole[]

  @@unique([companyId, email])
  @@index([tenantId, companyId, status])
  @@map("users")
}
```

Physical column names: platform tables (`outbox_messages`, `inbox_messages`, `idempotency_keys`,
`audit_logs`, `scheduled_jobs`) use **snake_case** `@map`; business tables stay camelCase.
Hand-written `$queryRaw` must use physical names.

Platform tables (outbox, inbox, idempotency, audit, scheduler, notification) are copied from the
reference `prisma/schema/platform/` unchanged (minus dropped capabilities).

---

## 11. Verification battery (run after ANY change)

```bash
npx tsc --noEmit -p tsconfig.json
npm run lint:check
npm run format:check
npm run test:architecture
npm test
npm run build
NODE_ENV=test node -e "(async()=>{const{NestFactory}=require('@nestjs/core');const{AppModule}=require('./dist/app.module.js');const a=await NestFactory.create(AppModule,{preview:true});await a.init();await a.close();})()"
```

Architecture rules are ESLint-enforced (`npm run lint:check` fails otherwise):

0. Business tables tenant-scoped; foreign row = 404, never 403; natural key unique within company.
1. `src/platform/**` may not import `@business/**`.
2. Business modules import ONLY: `@platform` exported tokens via `imports: [PlatformModule]`, another
   module's `public/**` or `application/outbound-ports/**`, `@common` primitives, `shared-business`.
   Domain folders import no `@nestjs/*`.
3. Raw clients (Prisma, `amqplib`, `kafkajs`, `ioredis`) → `infrastructure`/`config`/`bootstrap`/
   `platform` only.
4. Hand-written `$queryRaw` uses physical column names.
5. Side effects leaving the process go through `OutboxWriterPort` inside `@Transactional()`.
6. Command use cases read `RequestContextPort` (CLS) and call `AbacPort.evaluate()` first; never
   inject `AuthenticationPort`/`CompanyConfigPort` directly.
7. RBAC at route level via `RbacGuard` + `@Rbac()`.
8. `src/common` holds only cross-layer primitives.

### Testing layout (copy reference `docs/testing-business-modules.md`)

| Kind | Location | Suffix | Runner |
| --- | --- | --- | --- |
| Unit | beside the file | `.spec.ts` | `npm test` |
| Component | `specifications/components/` | `.component-spec.ts` | `npm run test:specifications` |
| Integration | `specifications/integrations/` | `.integration-spec.ts` | `npm run test:specifications` |
| API | `specifications/api/` | `.api-spec.ts` | `npm run test:specifications` |
| Contract | `specifications/contracts/` | `.contract.spec.ts` | `npm run test:specifications` |
| Security | `specifications/security/` | `.security.spec.ts` | `npm run test:specifications` |
| Property | `specifications/properties/` | `.property-spec.ts` | `npm run test:specifications` |

Cross-cutting fakes/factories in `src/specifications/support/` and `src/specifications/utils/`; no
root `test/` folder.

---

## 12. Build order (phased — follow in order)

Run the §11 battery after each phase before moving on.

### Phase 0 — Scaffold
1. Fresh repo, `package.json` (copy deps from reference), `tsconfig.json` (paths above),
   `.prettierrc`, `eslint.config.mjs` (copy architecture rules), `nest-cli.json`, `jest` configs.
2. `src/config/*` facades (§7) + `config.module.ts`.
3. `src/infrastructure/*` clients (§5) + `infrastructure.module.ts`.
4. `src/common/*` primitives (§6).
5. `src/bootstrap/` + `main.ts` + `app.module.ts` wiring global guards/interceptors/pipes.
6. `docker-compose.yml` (postgres, redis, rabbitmq); `.env.example`.
7. Verify: `tsc`, `lint:check`, `format:check`, DI smoke test (empty business).

### Phase 1 — Platform subset
1. Copy kept `platform-common/*` + `platform-organization/authorization` from reference (§4.1).
2. Implement real `AuthenticationPort`, `RbacPort`, `AbacPort` (§4.4); keep tenancy guard.
3. Copy platform Prisma schema (outbox, inbox, idempotency, audit, scheduler, notification).
4. Wire `PlatformModule` (imports/exports kept modules only).
5. Verify battery + DI smoke test.

### Phase 2 — Foundation aggregates
1. `organization`, `user` + `credential`, `role`, `permission` domain + persistence + controllers.
2. Repository mappers, factories, invariants, value objects (Email, PasswordHash).
3. Unit + integration + security specs for tenant isolation.

### Phase 3 — Access flows
1. `session`, `token`, `otp` aggregates.
2. Register, login, refresh, logout, logout-all, verify-email, forgot/reset-password, MFA OTP.
3. Lockout policy, throttling, idempotency.
4. Wire notifications (verify/reset/otp/invite/lock) via `NotificationHandler` opt-ins.

### Phase 4 — Background & scheduled
1. Register scheduler handlers (session/token/otp purge, password-expiry reminder, unlock sweep).
2. Outbox consumers (lockout → notify, new-device → notify).
3. Audit recording on all security events.

### Phase 5 — Hardening
1. Property tests for token hashing/rotation, OTP attempt limits.
2. Contract tests for event envelopes + response DTOs.
3. Full battery green; Swagger verified.

---

## 13. Naming conventions

| Item | Convention | Example |
| --- | --- | --- |
| Use case file | `<verb>-<noun>.usecase.ts` | `login-user.usecase.ts` |
| Use case class | `<Verb><Noun>UseCase` | `LoginUserUseCase` |
| Repository port | `<Module>CommandRepository` | `UserCommandRepository` |
| Query port | `<Module>Query` | `UserQuery` |
| Integration/publisher port | `<Module>PublisherPort` | `UserPublisherPort` |
| Outbound port | `<Name>Port` | `PasswordHasherPort` |
| Public port | `<Module>For<Consumer>Port` | `UserForAccessPort` |
| Facade | `<Module>For<Consumer>Facade` | `UserForAccessFacade` |
| Prisma repo | `Prisma<Module><Type>Repository` | `PrismaUserCommandRepository` |
| Adapter | `<Name>Adapter` | `JwtAuthenticationAdapter` |
| Request DTO | `<name>.request.dto.ts` | `login.request.dto.ts` |
| Response DTO | `<name>.<web|mobile>.response.dto.ts` | `login.web.response.dto.ts` |
| Policy | `<name>.policy.ts` | `lockout.policy.ts` |
| Invariants | `<module>.invariants.ts` | `user.invariants.ts` |
| Factory | `<module>.factory.ts` | `user.factory.ts` |
| Event | `<module>.<event>.event.ts` | `user.registered.event.ts` |

Invariants and policies are **classes with static methods** (no global registry); use cases and
aggregates call them statically and throw with `statusCode` (422) on violation.

---

## 14. Rules recap (non-negotiable)

- Business → platform via port tokens only; platform never imports business.
- No raw clients outside infrastructure/config/bootstrap/platform.
- `@Transactional()` on every command use case; side effects via `OutboxWriterPort` in the same
  transaction.
- Request context only from `RequestContextPort`; ABAC before business steps; RBAC at routes.
- Every business table tenant-scoped; foreign row = 404.
- Zod request/response DTOs; controllers thin (parse → use case → response).
- Migrations are the source of truth; never edit `src/generated/**`.
- No comments in code unless asked.
- Never commit secrets or `.env`.
- Public contracts change only with explicit owner approval; commit only when asked.
- Run the §11 verification battery after every change.

---

## 15. Where to look in the reference repo

| Topic | File |
| --- | --- |
| Architecture / layers / dependency rules | `docs/architecture.md` |
| Platform module anatomy | `docs/platform-standard.md` |
| Business module generation | `docs/generate-business-module.md` |
| Platform service generation | `docs/generate-platform-service.md` |
| Testing conventions | `docs/testing-business-modules.md` |
| ESLint/Prettier/TS rules | `docs/eslint-formatting-typescript-rules.md` |
| Saga (drop, for reference only) | `docs/saga.md` |
| Example aggregate | `src/business/product-management/product/**` |
| Platform capability shape | `src/platform/platform-common/scheduler/**` |
| Auth/tenancy seam | `src/platform/platform-common/authentication/**`, `.../tenancy/http/tenancy-auth.guard.ts` |
| Config pattern | `src/config/auth.config.ts` |
| Composition root | `src/app.module.ts`, `src/platform/platform.module.ts` |
```