# IAM — deferred build plan (NEXT UP)

> **Status: NOT IMPLEMENTED — deferred.** This is the reminder to build the ERP
> IAM domain next. Today the repo only has a tenancy guard:
> `src/platform/context/guards/tenancy-auth.guard.ts` (JWT/header trust
> boundary) + `src/config/auth.config.ts`. There is **no** `business/iam`
> context, **no** sessions, membership, centers, authorization, or SoD.
>
> Source design: `/home/master-builder/Documents/Common/erp/iam/` (3 pages:
> `index.html`, `iam.html`, `authorization.html`). This file is the
> implementation checklist distilled from it.

## Scope (two services, one system)

- **Auth (IamAuthN)** — proves identity, holds the session, resolves the
  entitled context (tenant → company → center).
- **Authorization (AuthZ)** — decides. `ALLOW + company scope filter +
obligations`, or `DENY`. Default DENY; explicit DENY wins.

Company is the workspace; tenant isolates. One login, every center.

## Target layout (business context, per `docs/BUSINESS-MODULE-GUIDE.md`)

```text
src/business/iam/
├── tenancy/          tenants, companies, provisioning saga, memberships, scopes, invitations
├── identity/         users, identities, credentials, credential_history, authenticators, IdPs, external_identities
├── authentication/   policies, attempts, auth_transactions, challenges, recovery, sessions, refresh_tokens, Redis adapter
├── center/           centers catalog + domains
├── machine-access/   api_clients, service_accounts, api_keys
├── audit/            security_events (hash-chained), sensitive_access_log
├── public/           iam-entitlement.port.ts, iam-session.port.ts (+ authorization ports)
└── iam.module.ts     imports PlatformModule; composes sub-contexts
```

Authorization is a separate context with its own page (`authorization.html`):
roles / permissions / role_permissions / role_assignments(center+scope+validity)
/ policies / delegations — decided by the AuthZ service, never inline.

## Public ports (guards inject these)

- `IamEntitlementPort.resolveContext({ user, tenant, company, center })`
- `IamEntitlementPort.getScopes({ membership })` — mandatory company scopes
- `IamSessionPort.verifySession({ sessionId })` — Redis lookup, O(1) revoke

```ts
const context = await this.iamEntitlement.resolveContext({
  user: userId,
  tenant: tenantId,
  company: companyId,
  center: 'ERP',
});
const decision = await this.authorization.check({
  ...context,
  resource: 'purchase-order',
  action: 'approve',
});
if (decision.status !== 'ALLOW') throw new ForbiddenException();
return this.purchaseOrders.approve(id, decision.scopeFilter);
```

## Gate order (default DENY)

1. Center gate — resolve from Host; unknown/inactive ⇒ DENY.
2. Session gate — Redis session; missing/expired/revoked ⇒ 401.
3. Membership gate — membership × tenant active + in window; tenant active.
4. Workspace gate — `membership_scopes` must include company (server-side, never trusted from client).
5. Center active gate — else 403.
6. Decision call — AuthZ returns ALLOW + scope filter, or DENY.
7. Domain gate — ERP invariants ⇒ 422 (not 403).
8. Commit + audit — `security_events` (+ `sensitive_access_log`) and the outbox row in one transaction.
9. Async fan-out — outbox relay deletes authz keys + revokes sessions.

## Tables (≈40, grouped by context)

Tenancy: `tenants`, `companies`, `tenant_provisioning_requests`,
`tenant_provisioning_steps`, `memberships`, `membership_scopes` (company_id
mandatory), `invitations`.
Center: `centers`.
Identity: `users`, `identities`, `credentials`, `credential_history`,
`authenticators`, `identity_providers`, `external_identities`.
Authentication: `authentication_policies`, `authentication_attempts`,
`auth_transactions`, `challenges`, `recovery_requests`, `sessions`,
`refresh_tokens`.
Machine: `api_clients`, `service_accounts`, `api_keys`.
Audit: `security_events` (append-only, hash-chained),
`sensitive_access_log`.
Reliability: reuse platform `outbox` + `inbox`.

Rules: tenant path on every owned row; NULL-tenant uniqueness closed with
`NULLS NOT DISTINCT`; secrets hashed only (Argon2id/bcrypt, history N, min 12);
no plaintext OTP/API/IdP secret (manager pointers); audit no UPDATE/DELETE.

## Session design (hybrid)

Server-side identity session in Redis (O(1) revocation) + short context JWT for
the hot path (zero I/O, `policy_version` pointer, never materialized perms).
One identity session, many context JWTs (cross-center SSO).

## Security controls (each verifiable)

Passwords (Argon2id + history + min 12) · secrets never plaintext · central
server-side session (Secure/HttpOnly/SameSite) · never trust frontend
company/tenant/role ids · no executable scope/policy · machine keys
hashed/prefixed/expiring/rotatable · append-only audit · no secrets in audit ·
rate-limit login/OTP/tenant + anomaly · tenant isolation (tenant path + optional
RLS) · polymorphic refs eliminated (except app-validated `principal_id`) ·
NULL-UQ loophole closed · billing/ERP invariants outside IAM.

## Build sequence (from the design; do not reorder)

1. Identity (users/identities/credentials/history)
2. AuthN (policies/attempts/transactions/challenges/OTP/MFA/passkey/OIDC + recovery)
3. Session (Redis sessions, cookie, rotation, revoke-all, version)
4. Tenancy (tenants, companies, provisioning saga)
5. Center (catalog + domains)
6. Membership + invitations + scopes
7. Authorization track (separate service)
8. Machine access (clients/service-accounts/keys)
9. Caching + invalidation (outbox-driven DEL, fail-closed on miss)
10. Reliability (outbox/inbox relay + dedup)
11. Audit (security_events + sensitive log, hash chain)
12. Gateway integration (domain→center, session verify, context mint)
13. ERP module integration (scope filters + domain invariants)
14. Hardening (rate limits, anomaly, load/security tests)

## Config (typed getters, no raw `process.env`)

`SESSION_TTL_MS`, `REFRESH_TTL_MS`, `PASSWORD_MIN_LENGTH`, `RATE_LIMIT_LOGIN_*`,
`RATE_LIMIT_OTP_*`, `CHALLENGE_TTL_MS`, `INVITATION_TTL_MS`,
`IMPERSONATION_MAX_MINUTES`, `PROVISIONING_SLUG_RESERVED`.

## Before coding

Read `docs/BUSINESS-MODULE-GUIDE.md` + `ARCHITECTURE.md` §3/§4/§5/§15; the IAM
design pages are the product spec. Add `business/iam/**` to `businessModules` in
`eslint.config.mjs`; wire `IamModule` into the context composition; run the full
verification battery in `AGENTS.md`.
