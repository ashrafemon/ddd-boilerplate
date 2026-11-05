# Authorization — RBAC and ABAC

> Normative companion to [`ARCHITECTURE-RULES.md`](./ARCHITECTURE-RULES.md) §8
> (R-36…R-43) and [`REQUEST-LIFECYCLE.md`](./REQUEST-LIFECYCLE.md).
> Covers RBAC responsibilities, ABAC responsibilities, middleware/guard boundaries,
> request-context requirements, company-configuration dependencies, the execution
> sequence, and the current implementation gap.

---

## 1. RBAC (Role-Based Access Control)

### Responsibility

- **Guards** enforce RBAC (R-38/R-39). A request is allowed or denied based on the
  authenticated subject's roles/permissions and the route/operation metadata.
- RBAC decisions happen **before** the controller and use case run.
- Guards read the already-established request context (roles/permissions/claims) and
  route metadata; they do not initialize context or fetch company configuration.

### Rules

- No RBAC logic in controllers, use cases, repositories, or domain code.
- No RBAC decision in middleware (middleware only resolves authentication).
- Denial must not leak whether a foreign resource exists; repository scoping still
  returns 404 for foreign rows.
- Route metadata (required roles/permissions) belongs with the route/handler, not
  duplicated in use cases.

### Current state

- `TenancyAuthGuard` (`src/platform/platform-common/context/guards/tenancy-auth.guard.ts`)
  enforces the tenancy/authentication trust boundary (`TENANCY_MODE=single|multi`).
- There is **no RBAC guard** and no role/permission enforcement beyond JWT claim
  presence.
- Full IAM/authorization is deferred; read `docs/IAM-BUILD-PLAN.md` before designing it.

---

## 2. ABAC (Attribute-Based Access Control)

### Responsibility

- The **use case** configures the **base ABAC context** immediately after retrieving
  the complete request context (R-41), before any business operation.
- The base ABAC context describes the subject and environment attributes used by
  policy/authorization decisions (for example tenant, company, user, roles, department,
  plant/warehouse, resource attributes, request attributes).
- Detailed resource-level ABAC decisions may be delegated to a policy/authorization
  service, but the base context MUST be established first.

### Rules

- Base ABAC configuration is part of the use-case opening sequence; it must not be
  deferred until after a repository read or calculation.
- ABAC must use the context established by middleware/guard; it must not re-resolve
  tenancy/authentication.
- Authorization decisions must not be embedded in controllers, facades, repositories,
  or domain factories. Domain **policies** are business rules, not a substitute for
  access control.
- If authorization data is missing, fail closed for protected operations.

### Current state

- No base ABAC context exists.
- No attribute-based authorization service is wired.
- IAM is deferred; the exact ABAC shape is an open question (ADR-010).

---

## 3. Middleware vs. guard boundaries

| Concern | Middleware | Guard | Use case |
| --- | --- | --- | --- |
| Initialize request context | **Yes (owner)** | No | No |
| Resolve tenancy | **Yes** | Read only | Read only |
| Resolve authentication | **Yes** | Read/verify as needed | Read only |
| Fetch company configuration | **Yes** | No | Read from context |
| Attach complete context | **Yes** | No | No |
| RBAC enforcement | No | **Yes (owner)** | No |
| Base ABAC configuration | No | No | **Yes (owner)** |
| Business orchestration | No | No | **Yes** |

Boundary violations to reject in review:

- middleware performing RBAC or invoking use cases;
- guard resolving tenancy/company config or invoking use cases;
- use case re-parsing raw headers/JWT instead of reading the complete context;
- controller checking roles/permissions;
- cache/idempotency endpoint decorators running before guards or bypassing RBAC;
- use cases using cache/idempotency decorators (only `@Transactional()` is allowed).

---

## 4. Request-context requirements for authorization

The complete context MUST provide, before guards/use cases:

- subject identity (`userId`/`sub`) and authentication method;
- `tenantId` and `companyId`;
- roles and (if available) permissions;
- claims/attributes needed by ABAC;
- company configuration resolved from the context;
- request/correlation ids for audit.

Missing required fields for a protected operation MUST cause a fail-fast error, not a
default-company/default-tenant fallback. The single-tenant default company is allowed
only where the repo-wide tenancy rules explicitly allow it.

---

## 5. Company configuration dependency

- Middleware fetches company configuration **using the request context** (R-37).
- Use cases read the resolved configuration from the context; they MUST NOT fetch it
  themselves once Phase 5 is complete.
- In `TENANCY_MODE=multi`, a missing company configuration row is a hard failure (no
  silent default), matching `ARCHITECTURE.md`.
- Audit/approval thresholds/default currency must come from the resolved configuration,
  not ad-hoc queries in use cases.

---

## 6. Execution sequence (normative)

```text
1. Middleware
   1.1 create request scope/ids
   1.2 resolve tenancy
   1.3 resolve authentication
   1.4 fetch company configuration using the context
   1.5 attach the complete immutable context

2. Guard
   2.1 read context
   2.2 evaluate RBAC for the route/operation
   2.3 deny before controller on failure

3. Controller endpoint
   3.1 validate/bind input
   3.2 apply endpoint-only cache/idempotency decorators (after the guard)
   3.3 invoke use case

4. Use case
   4.1 retrieve the complete request context
   4.2 configure the base ABAC context
   4.3 perform orchestration sequentially (only `@Transactional()` decorator)
```

Any deviation is a rule violation (R-36…R-43) and must be recorded as an audit finding.

---

## 7. Current gaps and dependencies

| Gap | Impact | Phase |
| --- | --- | --- |
| Context seeded by an interceptor, not middleware | Target sequence not met; company config not attached | Phase 5 |
| Company config fetched inside use cases | Use cases do extra work and duplicate resolution | Phase 5 |
| No RBAC guard | Roles/permissions not enforced | Phase 5 (IAM dependency) |
| No base ABAC context | Attribute-based decisions impossible | Phase 5 (IAM dependency) |
| IAM/authorization deferred | Phase 5 may be blocked or require a minimal interim design | Resolve at P5-07/P5-09 |

**Open question (ADR-010):** Does Phase 5 implement a minimal RBAC/ABAC facade over the
existing JWT claims, or does it wait for the full IAM build? The answer determines
whether P5-07…P5-14 are executable or `BLOCKED`. Do not invent an authorization model
silently; record the decision before implementation.

---

## 8. Tests required (Phase 5/9)

- middleware establishes tenant/company/auth/config before controller execution;
- guard denies an unauthorized role before the use case runs;
- use case retrieves the complete context and configures base ABAC first;
- missing context/config fails fast in tenant-aware operations;
- foreign-tenant resource remains 404 (no existence leak);
- background worker restores context before authorization-dependent operations.
