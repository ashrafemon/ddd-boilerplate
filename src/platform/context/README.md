# platform/context — Request context & tenancy foundation

> The per-request identity session every other service reads: who is the
> user / tenant / company, which correlation ties logs–audit–outbox together,
> and the shared read-replica connection port.

## What it provides

1. **`RequestContextPort`** (bound to `ClsRequestContextService` over
   nestjs-cls): immutable per-request snapshot with `get()/require()/set()`
   and `run(patch, fn)` — `run` restores a *background* context (tenant,
   correlation) for BullMQ workers and outbox re-dispatch that have no HTTP
   request. Getters: requestId / correlationId / tenantId / organizationId /
   userId / roles.
2. **Identity trust (`TenancyAuthGuard`)** — registered as `APP_GUARD` in
   `src/app.module.ts` (not from this module on purpose). `TENANCY_MODE=single`:
   pass-through, `x-tenant-id`/headers trusted. `multi`: Bearer JWT signed
   with `JWT_ACCESS_SECRET` carrying a `tenantId` claim is mandatory; the
   verified identity is stashed on the request and `RequestIdInterceptor`
   ignores raw headers. `@SkipTenancy()` opts routes out.
3. **`PrismaReadPort`** — typing-only abstract class (`extends` of the
   generated client) bound to the infrastructure `ReplicationPrismaClient`;
   business *query* repositories inject this token instead of importing the
   generated client directly.

## Layout

```
ports/request-context.port.ts / request-context.ts (value object)
ports/prisma-read.port.ts
adapters/cls-request-context.service.ts
guards/tenancy-auth.guard.ts (exported for app.module wiring)
context.module.ts
```

## Who calls it / how

`RequestContextPort`: nearly every platform module (audit, numbering,
configuration, outbox, idempotency interceptor, scheduler/import/batch/recurring
workers + controllers) and `business/procurement/purchase-order/http`.
`PrismaReadPort`: `business/*/infrastructure/persistence` read-side only.
Import via `ContextModule` (exported through `PlatformModule`).

## Config / tenancy behaviour

Reads `security.tenancy.mode`, ` security.tenancy.{ttl, headers}`, `auth.jwt`.
Header names (`x-tenant-id`, `x-organization-id`, …) are configurable only
through the interceptor's documented contract; in multi mode headers are
never trusted.

## Rules & gotchas

- The CLS context is created once per request by `RequestIdInterceptor`
  (shared-kernel) — do not call `set()` on the request path; `run()` is the
  only sanctioned child-context mechanism.
- Fail-open behaviour of `TenantScope` is a deliberate single-tenant afford-
  ance; multi-tenant deployments MUST run `TENANCY_MODE=multi`, which makes
  the guard fail closed.
- `require()` throws if no context exists — signals a missing interceptor
  registration or a background path that forgot `run()`.
