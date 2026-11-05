# Cross-Cutting Concerns — Cache and Idempotency

> Normative companion to [`ARCHITECTURE-RULES.md`](./ARCHITECTURE-RULES.md) §7
> (R-32…R-35, R-46). Caching and idempotency MUST be decorator-driven, MUST be applied
> only at controller endpoints, and MUST NOT be invoked directly from use cases.

---

## 1. Principle

Cross-cutting concerns (cache, idempotency) are **aspects**, not business
orchestration. They are applied declaratively at the HTTP controller endpoint and
implemented by reusable decorators/interceptors backed by the platform ports. Use cases
remain orchestration-only and may use **only** the `@Transactional()` decorator.

```text
HTTP controller endpoint
  ├─ guards run first (tenancy + RBAC)
  ├─ @Idempotent()          → platform IdempotencyPort
  ├─ @Cacheable/@CacheEvict → platform CachePort
  ▼
use case @Transactional()   → no cache/idempotency decorators, no cache/idempotency ports
```

Background consumers are different: duplicate suppression is handled by the **Inbox**
(R-28/R-29), not by the HTTP idempotency decorator.

---

## 2. Caching

### 2.1 Rules

- Cache reads/writes MUST be applied through decorators at **controller endpoints**.
  Use cases MUST NOT inject or call `CachePort`/`ReadCachePort`, and MUST NOT use
  `@Cacheable`/`@CacheEvict`/`@CachePut`.
- Cache belongs to **query** endpoints; command endpoints may only invalidate affected
  keys (via a decorator), never read cache.
- Cache adapters are fail-open (a cache outage must not fail the business operation)
  and tenant/company key-scoped so one tenant cannot read another's cached data.
- Keys must be derived from the operation + tenant/company + relevant inputs; no
  unbounded or guessable cross-tenant keys. Include any authorization-relevant scope in
  the key.
- TTL and invalidation are part of the decorator contract, not scattered in use cases.
- Domain/application code must not depend on the cache technology.
- The guard runs before the endpoint decorator. If ABAC depends on data loaded inside
  the use case, do not cache the endpoint until the authorization boundary is
  strengthened; a cache hit must never bypass an authorization decision.

### 2.2 Required decorator surface (implementation-defined names)

| Decorator | Placement | Behavior |
| --- | --- | --- |
| `@Cacheable({ key, ttlMs? })` | query controller endpoint | return cached value on hit; populate on miss |
| `@CacheEvict({ key/pattern })` | command controller endpoint | invalidate after a successful write |
| `@CachePut` (optional) | command controller endpoint when read-your-write is required | update the entry after success |

The existing repo has `CachePort` and a `ReadCachePort` used by PurchaseOrder. There is
**no cache decorator yet**. Phase 7 must introduce the decorator(s), move cache
application to controller endpoints, and remove direct port usage from use cases.

### 2.3 Current violations to audit

- `PurchaseOrder` use cases inject `ReadCachePort` directly (confirmed target
  violation of R-33/R-46; do not copy).
- No `@Cacheable`/`@CacheEvict` exists; cache key/TTL/invalidation is manual.
- Cache use is concentrated in one module; the audit (P7-01) must enumerate every
  direct dependency and every endpoint that should own the decorator.

---

## 3. Idempotency

### 3.1 Rules

- Idempotency MUST be applied through `@Idempotent()` (or the platform's equivalent
  decorator) at a **controller endpoint**. Use cases MUST NOT inject/call
  `IdempotencyPort`, and MUST NOT apply `@Idempotent()`.
- The decorator reserves a key before the operation, replays the stored result on a
  duplicate, returns `409 BUSY` for a live claim, and `400 KEY_MISMATCH` when the same
  key is reused with a different request hash.
- Keys are operation-scoped (for example `sales.order.create` + tenant/company +
  client key), never business ids or timestamps.
- The claim must be released/failed when the operation fails so a retry is possible;
  crashed claims are taken over after the lease.
- Idempotency is for duplicate-effect suppression, not for authorization or
  concurrency control (use `DistributedLockPort` for one-winner-now).

### 3.2 Placement (clarified 2026-11-05)

- **HTTP:** decorate the controller endpoint (`@Idempotent()` on costly,
  non-idempotent POSTs). This is the only permitted placement for this decorator.
  Guards run before the endpoint, so authorization is still enforced on replays.
- **Use case:** never decorate with `@Idempotent()`; the only decorator permitted at
  use-case level is `@Transactional()`.
- **Non-HTTP/background:** use the **Inbox** for duplicate suppression. Do not add a
  programmatic idempotency decorator to a use case or consumer handler.
- Do not decorate both the controller and the use case for the same request; there is
  exactly one endpoint boundary.
- The endpoint decorator runs before the use case body. It is outside the use case's
  `@Transactional()` boundary; a replay returns the stored result without opening the
  business transaction.

### 3.3 Current state

- `@Idempotent()` + interceptor exist in
  `src/platform/platform-common/idempotency/http/`.
- It is used on selected platform HTTP endpoints (batch submit, import create, webhook
  inbound), not uniformly across business modules.
- No use case currently injects `IdempotencyPort` directly (verify in P7-02; if found,
  it is a violation).
- No use-case-level `@Idempotent()` decorator is permitted; audit and remove any such
  usage in Phase 7.

---

## 4. Decorator execution and composition

1. Guards run first (tenancy + RBAC), then controller-endpoint decorators.
2. Idempotency runs before cache: a replay must return the original result without
   recomputation; cache is for read acceleration, not replay.
3. The use case runs with `@Transactional()`; cache/idempotency decorators are outside
   the use-case execution and are not applied to its methods.
4. Cache invalidation runs after a successful write/transaction commit; a failed write
   must not evict/repopulate.
5. Decorators must not swallow domain errors; the idempotency failure path must release
   the claim and rethrow.
6. Decorators must preserve tenant/company scoping in keys and stored results.
7. Decorators must be composable and documented (order, key source, TTL, replay
   semantics) in the implementation README.
8. No business logic or calculations inside decorators; they are generic infrastructure.
9. The only decorator permitted on a use-case method is `@Transactional()` (R-46).

---

## 5. Prohibited patterns

```ts
// ❌ Use case injects a cache port.
constructor(private readonly cache: ReadCachePort) {}

// ❌ Use case injects an idempotency port.
constructor(private readonly idempotency: IdempotencyPort) {}

// ❌ Cache/idempotency decorators on the use case.
@Cacheable({ key: 'po' })
@Idempotent()
async execute(id: string) { ... }

// ❌ Manual cache read/write inside a use case.
const cached = await this.cache.get(key);
if (cached) return cached;
await this.cache.set(key, result);

// ❌ Manual idempotency reserve/complete inside a use case.
const claim = await this.idempotency.reserve(...);

// ❌ Programmatic idempotency decorator on a non-HTTP use case/consumer.
@Idempotent()
async handle(message: EventContract) { ... } // use the Inbox instead
```

Correct:

```ts
// Query endpoint owns cache.
@Cacheable({ key: ctx => `po:${ctx.tenantId}:${ctx.companyId}:${ctx.params.id}` })
@Get(':id')
async get(@Param('id') id: string) { return this.getPurchaseOrder.execute(id); }

// Command endpoint owns idempotency and invalidation.
@Idempotent()
@CacheEvict({ key: ctx => `po:${ctx.tenantId}:${ctx.companyId}:${ctx.params.id}` })
@Post()
async submit(@Body() dto: SubmitDto) { return this.submitPurchaseOrder.execute(dto); }
```

```ts
// Use case: transaction boundary only.
@Transactional()
async execute(id: string): Promise<PurchaseOrderView> { ... }
```

---

## 6. Audit checklist (Phase 7)

- [ ] Enumerate every use case injecting `CachePort`/`ReadCachePort` (P7-01).
- [ ] Enumerate every use case injecting `IdempotencyPort` (P7-02).
- [ ] Inventory existing cache decorators (P7-03) and idempotency decorators (P7-04).
- [ ] Document decorator execution/composition at controller endpoints (P7-05).
- [ ] Implement/refactor cache decorators at controller endpoints (P7-06).
- [ ] Implement/refactor idempotency decorators at controller endpoints (P7-07).
- [ ] Remove direct port calls and decorators from use cases (P7-08).
- [ ] Verify behavior (hit/miss/invalidation/replay/BUSY/KEY_MISMATCH/tenant isolation)
      (P7-09).
- [ ] Add tests (P7-10).
- [ ] Verify decorator placement and the `@Transactional()` boundary (P7-11).

---

## 7. Tests required

- Cache hit returns the cached value without executing the use case body; miss executes
  once and stores.
- Cache key includes tenant/company; one tenant cannot read another's entry.
- A successful write evicts/updates the affected key; a failed write does not.
- A cache outage is fail-open (business operation still succeeds).
- Idempotent replay returns the byte-identical original result and does not re-run the
  use case.
- `BUSY` returns 409 and `KEY_MISMATCH` returns 400 per the platform contract.
- A failed operation releases the claim so a retry can succeed.
- Guards run before endpoint decorators; a cached response is never served to an
  unauthorized caller.
- No use case injects cache/idempotency ports or uses cache/idempotency decorators;
  only `@Transactional()` is present at use-case level (architecture test in Phase 9).
- Background duplicate suppression is exercised through the Inbox, not `@Idempotent()`.
