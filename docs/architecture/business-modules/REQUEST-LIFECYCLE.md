# Request Lifecycle

> Normative companion to [`ARCHITECTURE-RULES.md`](./ARCHITECTURE-RULES.md) §8
> (R-36…R-43) and [`AUTHORIZATION.md`](./AUTHORIZATION.md).
> Describes the target HTTP request sequence, the context contract, background
> execution, and the current implementation gaps.

---

## 1. Target sequence (HTTP)

```text
HTTP request
  │
  ├─ 1. Middleware: establish + assign the complete request context
  │      • request/correlation ids, tenant, company, user, roles, locale, ip, UA
  │      • resolve tenancy
  │      • resolve authentication
  │      • fetch company configuration using the request context
  │      • attach the complete context for downstream execution
  │
  ├─ 2. Guards: RBAC enforcement
  │      • verify the authenticated subject's roles/permissions for the route
  │      • reject/allow before the controller runs
  │
  ├─ 3. Controller endpoint (thin) + endpoint decorators
  │      • bind route/query/body (Zod DTO validation)
  │      • @Idempotent / @Cacheable / @CacheEvict at this endpoint only (R-46)
  │      • invoke the use case
  │      • return { data, message }
  │
  ├─ 4. Use case (entry point) — @Transactional() only
  │      • retrieve the complete request context (R-40)
  │      • configure the base ABAC context (R-41)
  │      • orchestrate sequentially (R-42):
  │          application services, outbound ports,
  │          domain repositories, domain services, domain factories
  │      • handle errors / return the response
  │
  ├─ 5. Application/domain execution
  │      • domain services perform calculations/domain operations
  │      • factories build aggregates and enforce creation invariants
  │      • repositories persist through ports
  │      • outbox writer appends events inside the transaction
  │
  └─ 6. Response pipeline
         • global success/error envelope
         • device-specific response mapping (web/mobile)
```

---

## 2. Step details and rules

### 2.1 Middleware — context establishment (R-36, R-37)

Middleware MUST run before guards/controllers and MUST produce a **complete** context:

| Field | Purpose |
| --- | --- |
| `requestId`, `correlationId` | traceability across logs/outbox/audit |
| `tenantId` | tenancy scoping (owned documents strict; master data includes shared rows) |
| `companyId` | company-scoped natural keys and numbering |
| `userId` / subject | actor attribution (audit, approval trails) |
| `roles` / permissions | RBAC input for guards |
| locale, ip, userAgent | logging/policy inputs |
| company configuration | default currency, approval thresholds, feature/config decisions |
| auth method/claims | ABAC attributes and audit |

Rules:

- The context MUST be initialized by middleware, not by an interceptor, guard, or use
  case.
- Authentication/tenancy resolution MUST happen before company configuration is fetched.
- Company configuration MUST be fetched using the request context and attached to it.
- The context MUST be immutable for the request after assignment (downstream reads
  only).
- Middleware MUST NOT make RBAC decisions or invoke use cases.

### 2.2 Guard — RBAC (R-38, R-39)

- Guards MUST enforce RBAC before the controller executes.
- Guards MUST read the already-established context; they must not initialize it,
  resolve tenancy, fetch company config, or call use cases.
- Authorization failures are transport-level (401/403) and must not leak resource
  existence (foreign/unauthorized resource reads remain 404 where the repository scopes
  them).

### 2.3 Controller — transport only (R-01…R-03, R-46)

- Validate/bind input, call exactly the use case(s) needed, return the response envelope.
- Cache and idempotency decorators (`@Idempotent`, `@Cacheable`, `@CacheEvict`) are
  applied **only at controller endpoints**. They run after guards (so RBAC still
  applies) and before the use case.
- No conditional business logic, calculations, repository/domain access, or platform
  port usage.
- No `@Transactional()` at the controller; the transaction boundary belongs to the use
  case.

### 2.4 Use case — context first, then orchestration (R-11, R-40…R-43, R-46)

Mandatory opening sequence:

1. Retrieve the **complete** request context from the context port.
2. Configure the **base ABAC context** from that context (subject, tenant, company,
   roles, attributes).
3. Only then perform the orchestration steps.

The use case MUST NOT start business operations before step 2. If the context is
missing/incomplete, the use case MUST fail fast (do not fall back silently to defaults
in tenant-aware operations).

After the opening sequence the use case may orchestrate:

- application services,
- outbound ports,
- domain repositories,
- domain services,
- domain factories.

It MUST NOT call facades, perform calculations/business logic, use cache/idempotency
decorators, or inject cache/idempotency ports. The **only** decorator permitted at the
use-case level is `@Transactional()`; it may be used to manage the transaction boundary
(R-46).

### 2.5 Application/domain execution

- Domain services own calculations/specialized operations.
- Factories are the sole creation path and enforce creation invariants.
- Invariants/policies are the only components that throw domain-level errors.
- Repositories persist through ports; command repos participate in the use case's
  `@Transactional()` boundary.
- Outbox appends happen inside the same transaction; no direct broker publish.
- **Unavailable capabilities (R-45):** business modules depend on the outbound port and
  its contract; do not implement or recreate the unavailable module/integration. The
  adapter can be supplied later without changing orchestration.

### 2.6 Response

- Success: `{ status: 'SUCCESS', statusCode, data, message }` via the global
  interceptor; controllers return `{ data, message }`.
- Validation: `422 VALIDATE_ERROR`; HTTP errors: `{ status: 'ERROR', ... }`; unknown:
  `500 SERVER_ERROR` with no detail leak.
- `@DeviceResponse(mobile, web)` maps read payloads by `x-device-type`.

---

## 3. Context contract

The context MUST be available as one coherent snapshot (directly or through a port)
with at least:

```ts
interface CompleteRequestContext {
  requestId: string;
  correlationId?: string;
  tenantId?: string;
  companyId?: string;
  userId?: string;
  roles: string[];
  permissions?: string[];
  locale?: string;
  ip?: string;
  userAgent?: string;
  authMethod?: string;
  claims?: Record<string, unknown>;
  companyConfig: CompanyConfiguration; // resolved by middleware
  abac?: BaseAbacContext;              // configured at use-case start
}
```

Exact field names are implementation-defined (P5-10 defines the contract), but the
presence and ordering guarantees above are mandatory.

---

## 4. Background / non-HTTP execution

Middleware does not run for BullMQ workers, schedulers, outbox dispatch, consumers, or
cron jobs. Those paths MUST restore an equivalent context before touching services that
read it:

```ts
await this.requestContext.run({ tenantId, companyId, correlationId }, () =>
  this.handler.handle(payload),
);
```

Rules:

- The restored context MUST include tenancy/company/correlation at minimum.
- Company configuration MUST be resolved/attached before business operations that need
  it.
- The use-case opening sequence (context retrieval + base ABAC) still applies; a
  missing context is a failure, not a silent default.
- Duplicate suppression in background consumers uses the Inbox, not `@Idempotent()`;
  cache/idempotency decorators remain HTTP-controller-endpoint concerns (R-46).
- Recorded as ADR-013 (middleware-only wording vs. background execution).

---

## 5. Current implementation mapping (as of Phase 0)

| Target step | Current implementation | Gap |
| --- | --- | --- |
| Middleware establishes context | `RequestIdInterceptor` seeds CLS with tenant/company/user/roles/locale/ip/UA | Interceptor, not middleware; no company config; no auth resolution in the same step. |
| Tenancy resolution | `TenancyAuthGuard` + headers/JWT (`TENANCY_MODE`) | Works for tenancy; guard also does authentication today, which target assigns to middleware. |
| Authentication resolution | `TenancyAuthGuard` (multi-mode JWT) | Target assigns to middleware; no full IAM. |
| Company config retrieval | `CompanyConfigPort` injected into use cases | Target requires middleware to fetch and attach it; use cases read it from context. |
| RBAC guard | None | Not implemented; IAM deferred. |
| Use case context retrieval | Use cases call context/platform ports ad hoc | Target requires a uniform opening sequence. |
| Base ABAC context | None | Not implemented. |
| Sequential orchestration | Per use case | Audit/migration required. |

These gaps are **not** to be fixed in Phase 0. They are audited in Phase 1 and
implemented in Phase 5 (see [`IMPLEMENTATION-ROADMAP.md`](./IMPLEMENTATION-ROADMAP.md)).
The IAM dependency may block parts of Phase 5; see ADR-010 and
`docs/IAM-BUILD-PLAN.md`.

---

## 6. Failure and ordering guarantees

1. No use case executes business operations before context + base ABAC are ready.
2. No guard performs tenancy/config fetching or business work.
3. No middleware performs RBAC or use-case work.
4. RBAC denial happens before the controller; tenancy visibility remains a repository
   concern (foreign ⇒ 404, no existence leak).
5. A missing/incomplete context in a tenant-aware operation fails fast.
6. Transaction, outbox append, and aggregate persistence remain in one unit of work.
7. Guards run before controller endpoint decorators; cache/idempotency must not bypass
   RBAC or tenant scoping.
8. Use cases use only `@Transactional()`; cache/idempotency decorators and ports are
   outside use-case execution.
9. Unavailable integrations remain port/contract dependencies, not fake or recreated
   modules.
