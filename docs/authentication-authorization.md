# ERP Boilerplate — Authentication, Authorization, and Tenancy

This document describes how authentication, authorization, and multi-tenancy work in the
system, from request entry through to business use case enforcement.

## Overview

Authorization follows this flow:

```
HTTP Request
    │
    ▼
┌─────────────────────────────────────┐
│  CompanyConfigContextMiddleware     │  (stamps company config into CLS)
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│  TenancyAuthGuard (APP_GUARD)       │  (enforces tenancy boundary)
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│  RbacGuard (APP_GUARD)              │  (route-level RBAC via @Rbac decorator)
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│  Controller → Use Case              │  (thin controller calls use case)
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│  Use Case                           │  (reads CLS via RequestContextPort)
│  1. Require RequestContext          │     → tenantId, companyId, userId, roles,
│  2. AbacPort.evaluate()             │     defaultCurrency, autoApproveThreshold,
│                                       │     overReceiptTolerance
└─────────────────────────────────────┘
```

## Tenancy modes

`TENANCY_MODE` in `.env` controls the platform trust boundary:

| Mode | Behavior |
|------|----------|
| `single` (default) | `x-tenant-id`/`x-organization-id` headers are trusted — for dev, internal deployments, or when a verified gateway sits in front |
| `multi` | Every request needs `Authorization: Bearer <JWT>` signed with `JWT_ACCESS_SECRET` carrying a `tenantId` claim. Raw identity headers are ignored. Anonymous requests are rejected (except `@SkipTenancy()` routes such as `GET /api/v1/metrics`). Missing tenant/company config rows fail hard |

## CLS RequestContext

All request-scoped values propagate through CLS (`nestjs-cls`) and are available across
HTTP handlers, use cases, repositories, outbox records, and message consumers:

| Field | Type | Source |
|-------|------|--------|
| `requestId` | string | Generated UUID per request |
| `correlationId` | string | From `x-correlation-id` header or generated |
| `tenantId` | string? | From JWT claim (multi) or `x-tenant-id` header (single) |
| `companyId` | string? | From JWT claim (multi) or `x-company-id` header (single) |
| `userId` | string? | From JWT `sub` claim (multi) or `x-user-id` header (single) |
| `roles` | string[] | From JWT `roles` claim (multi) or `x-roles` header (single) |
| `locale` | string | From `accept-language` header, default `en` |
| `ip` | string? | Request IP |
| `userAgent` | string? | Request User-Agent |
| `defaultCurrency` | string? | Stamped from company config by middleware |
| `autoApproveThreshold` | number? | Stamped from company config by middleware |
| `overReceiptTolerance` | number? | Stamped from company config by middleware |

### RequestContextPort

Business use cases read everything from `RequestContextPort`:

```ts
const ctx = this.requestContext.require();
const companyId = ctx.companyId;       // required for business operations
const userId = ctx.userId;             // authenticated user
const tenantId = ctx.tenantId;         // current tenant
const roles = ctx.roles;               // user roles
const defaultCurrency = ctx.defaultCurrency ?? 'USD';
```

`require()` throws if no context exists. `get()` returns the context or undefined.
`set(data)` merges partial data into the existing context. `run(data, fn)` executes a
function with a restored context (used by background workers).

## Middleware: CompanyConfigContextMiddleware

`CompanyConfigContextMiddleware` runs early in the HTTP pipeline:

1. Reads `companyId` from the `x-company-id` header.
2. Resolves `CompanyConfigPort.getCompanyConfig(companyId)`.
3. Stamps `defaultCurrency`, `autoApproveThreshold`, `overReceiptTolerance` into CLS
   via `RequestContextPort.set()`.
4. Fail-closed: if company config cannot be resolved, leaves the context without company
   config fields so downstream ABAC/usecase logic can detect the missing config.

Registered in `bootstrap/index.ts` before any route handler runs.

## RequestIdInterceptor

`RequestIdInterceptor` is a global interceptor that:

1. Generates a `requestId` (UUID) and propagates `correlationId` (from `x-correlation-id`
   header or generated).
2. Resolves identity from `TenancyAuthGuard`-stashed verified identity (multi mode) or
   raw headers (single mode).
3. Seeds the immutable CLS `RequestContext` snapshot via `RequestContextPort.set()` —
   using `set()` (merge) rather than raw `cls.set()` so company config stamped by the
   middleware is preserved.

## TenancyAuthGuard

`TenancyAuthGuard` is registered as a global `APP_GUARD`. It:

- In `multi` mode: verifies the JWT and stashes the verified identity on the request.
- In `single` mode: trusts `x-tenant-id`/`x-company-id`/`x-user-id`/`x-roles` headers.
- Rejects anonymous requests except `@SkipTenancy()` routes.

## RBAC (Route-Level)

### `@Rbac()` decorator

```ts
import { Rbac } from '@shared-kernel/decorators/rbac.decorator';

@UseGuards(RbacGuard)
@Rbac('PurchaseOrder', 'approve')
@Patch(':id/approve')
async approve(@Param('id') id: string) { ... }
```

### `RbacGuard`

`RbacGuard` is registered as a global `APP_GUARD`. For each route handler:

1. Reads `@Rbac()` metadata (`resource`, `action`) via `Reflector`.
2. If no metadata, allows the request (returns `true`).
3. Resolves `userId` from CLS `RequestContext`.
4. If no `userId`, throws `ForbiddenException('No authenticated user')`.
5. Calls `RbacPort.can({ userId, resource, action })`.
6. If not allowed, throws `ForbiddenException('RBAC denied: <action> on <resource>')`.

## ABAC (Use-Case Level)

### `AbacPort`

```ts
export interface AbacContext {
  tenantId: string;
  companyId: string;
  userId: string;
  roles: string[];
  [key: string]: unknown;
}

export interface AbacResult {
  decision: 'ALLOW' | 'DENY';
  scopeFilter?: Record<string, unknown>;
  reason?: string;
}

export interface AbacCheck {
  context: AbacContext;
  resource: string;
  action: string;
  scopeFilter?: Record<string, unknown>;
}

export abstract class AbacPort {
  abstract evaluate(check: AbacCheck): Promise<AbacResult>;
}
```

### Use case ABAC enforcement pattern

Every command use case follows this pattern:

```ts
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { AbacPort } from '@platform/platform-organization/authorization/ports/abac.port';

@Injectable()
export class CreateProductUseCase {
  constructor(
    private readonly productRepository: ProductCommandRepository,
    private readonly integrationEvent: ProductPublisherPort,
    private readonly requestContext: RequestContextPort,
    private readonly abac: AbacPort,
  ) {}

  @Transactional()
  async execute(input: CreateProductRequest): Promise<string> {
    // 1. Read context from CLS (never inject AuthenticationPort or CompanyConfigPort)
    const ctx = this.requestContext.require();
    const companyId = ctx.companyId;
    if (!companyId) {
      throw new NotFoundException('Company not found in request context');
    }

    // 2. Evaluate ABAC before business steps
    const abacResult = await this.abac.evaluate({
      context: {
        tenantId: ctx.tenantId ?? '',
        companyId,
        userId: ctx.userId ?? '',
        roles: ctx.roles,
        defaultCurrency: ctx.defaultCurrency ?? 'USD',
        autoApproveThreshold: ctx.autoApproveThreshold ?? 0,
        overReceiptTolerance: ctx.overReceiptTolerance ?? 0,
      },
      resource: 'Product',
      action: 'create',
    });
    if (abacResult.decision === 'DENY') {
      throw new ForbiddenException(abacResult.reason ?? 'ABAC denied');
    }

    // 3. Business steps
    // ...
  }
}
```

### No-op adapters (IAM deferred)

Until a real IAM service is implemented, no-op adapters are bound via `useExisting`:

| Port | Adapter location | Behavior |
|------|-----------------|----------|
| `AuthenticationPort` | `src/platform/platform-common/authentication/adapters/noop-authentication.adapter.ts` | `getIdentity()` returns `null` |
| `RbacPort` | `src/platform/platform-organization/authorization/adapters/noop-rbac.adapter.ts` | `can()` returns `true` (fail-open) |
| `AbacPort` | `src/platform/platform-organization/authorization/adapters/noop-abac.adapter.ts` | `evaluate()` returns `{ decision: 'ALLOW', scopeFilter: {} }` |

These allow the DI graph to boot without IAM. Replace with real implementations when IAM is
built; business use cases and guards require no changes.

## What is NOT implemented

- JWT issuance / login / token refresh
- User registration / profile management
- Role and permission assignment UI
- Real `AuthenticationPort` implementation (returns `null` via no-op adapter)
- Real `RbacPort` implementation (returns `true` via no-op adapter)
- Real `AbacPort` implementation (returns ALLOW via no-op adapter)

See `docs/IAM-BUILD-PLAN.md` (deferred) for the full IAM design.
