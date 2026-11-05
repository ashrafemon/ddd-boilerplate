# Cross-Cutting Concerns — Cache and Idempotency

> Normative companion to [`ARCHITECTURE-RULES.md`](./ARCHITECTURE-RULES.md) §7
> (R-32…R-35). Caching and idempotency MUST be decorator-driven and MUST NOT be
> invoked directly from use cases.

---

## 1. Principle

Cross-cutting concerns (cache, idempotency) are **aspects**, not business
orchestration. They must be applied declaratively at the boundary (controller/handler
or use-case method) and implemented by reusable decorators/interceptors backed by the
platform ports. Use cases must remain orchestration-only.

```text
HTTP / message / job boundary
  ├─ @Idempotent()        → platform IdempotencyPort (reserve/replay/complete/fail)
  └─ @Cacheable/@CacheEvict → platform CachePort
        │
        ▼
     use case (no cache/idempotency ports injected)
```

---

## 2. Caching

### 2.1 Rules

- Cache reads/writes MUST be applied through decorators; use cases MUST NOT inject or
  call `CachePort`/`ReadCachePort`.
- Cache belongs to **query** paths; command/use-case writes may only invalidate
  affected keys (via a decorator), never read cache.
- Cache adapters are fail-open (a cache outage must not fail the business operation)
  and tenant/company key-scoped so one tenant cannot read another's cached data.
- Keys must be derived from the operation + tenant/company + relevant inputs; no
  unbounded or guessable cross-tenant keys.
- TTL and invalidation are part of the decorator contract, not scattered in use cases.
- Domain/application code must not depend on the cache technology.

### 2.2 Required decorator surface (implementation-defined names)

| Decorator | Placement | Behavior |
| --- | --- | --- |
| `@Cacheable({ key, ttlMs? })` | query use-case method / handler | return cached value on hit; populate on miss |
| `@CacheEvict({ key/pattern })` | command use-case method / handler | invalidate after a successful write |
| `@CachePut` (optional) | write path when read-your-write is required | update the entry after success |

The existing repo has `CachePort` and a `ReadCachePort` used by PurchaseOrder. There is
**no cache decorator yet**. Phase 7 must introduce the decorator(s) and remove direct
port usage.

### 2.3 Current violations to audit

- `PurchaseOrder` use cases inject `ReadCachePort` directly (confirmed target
  violation of R-33; do not copy).
- No `@Cacheable`/`@CacheEvict` exists; cache key/TTL/invalidation is manual.
- Cache use is concentrated in one module; the audit (P7-01) must enumerate every
  direct dependency.

---

## 3. Idempotency

### 3.1 Rules

- Idempotency MUST be applied through a decorator (`@Idempotent()` or an equivalent
  programmatic decorator). Use cases MUST NOT inject/call `IdempotencyPort`.
- The decorator reserves a key before the operation, replays the stored result on a
  duplicate, returns `409 BUSY` for a live claim, and `400 KEY_MISMATCH` when the same
  key is reused with a different request hash.
- Keys are operation-scoped (for example `sales.order.create` + tenant/company +
  client key), never business ids or timestamps.
- The claim must be released/failed when the operation fails so a retry is possible;
  crashed claims are taken over after the lease.
- Idempotency is for duplicate-effect suppression, not for authorization or
  concurrency control (use `DistributedLockPort` for one-winner-now).

### 3.2 Placement

- HTTP boundary: decorate the controller/handler (`@Idempotent()` on costly,
  non-idempotent POSTs). This is the current platform pattern.
- Non-HTTP boundary (message/job/use-case invocation): use a programmatic decorator on
  the use-case method or the consumer handler, so the same platform port is reused.
- Do not decorate both the controller and the use case for the same request; choose one
  boundary to avoid double claims.
- The decorator must run before the use case body and must participate correctly in the
  transaction boundary (replay returns the stored result; a failed operation releases
  the claim).

### 3.3 Current state

- `@Idempotent()` + interceptor exist in
  `src/platform/platform-common/idempotency/http/`.
- It is used on selected platform HTTP endpoints (batch submit, import create, webhook
  inbound), not uniformly across business modules.
- No use case currently injects `IdempotencyPort` directly (verify in P7-02; if found,
  it is a violation).
- A programmatic (non-HTTP) idempotency decorator may need to be added in Phase 7.

---

## 4. Decorator execution and composition

1. Decorators are applied at the boundary, before the use case's context/ABAC sequence.
2. Idempotency runs before cache: a replay must return the original result without
   recomputation; cache is for read acceleration, not replay.
3. Cache invalidation runs after a successful write/transaction commit; a failed write
   must not evict/repopulate.
4. Decorators must not swallow domain errors; idempotency failure path must release the
   claim and rethrow.
5. Decorators must preserve tenant/company scoping in keys and stored results.
6. Decorators must be composable and documented (order, key source, TTL, replay
   semantics) in the implementation README.
7. No business logic or calculations inside decorators; they are generic infrastructure.

---

## 5. Prohibited patterns

```ts
// ❌ Use case injects a cache port.
constructor(private readonly cache: ReadCachePort) {}

// ❌ Use case injects an idempotency port.
constructor(private readonly idempotency: IdempotencyPort) {}

// ❌ Manual cache read/write inside a use case.
const cached = await this.cache.get(key);
if (cached) return cached;
await this.cache.set(key, result);

// ❌ Manual idempotency reserve/complete inside a use case.
const claim = await this.idempotency.reserve(...);
```

Correct:

```ts
@Cacheable({ key: ctx => `po:${ctx.tenantId}:${ctx.companyId}:${ctx.params.id}` })
async execute(id: string) { ... }

@Idempotent() // HTTP boundary, or a programmatic equivalent for non-HTTP
@Post()
async submit(@Body() dto: SubmitDto) { ... }
```

---

## 6. Audit checklist (Phase 7)

- [ ] Enumerate every use case injecting `CachePort`/`ReadCachePort` (P7-01).
- [ ] Enumerate every use case injecting `IdempotencyPort` (P7-02).
- [ ] Inventory existing cache decorators (P7-03) and idempotency decorators (P7-04).
- [ ] Document decorator execution/composition (P7-05).
- [ ] Implement/refactor cache decorators (P7-06).
- [ ] Implement/refactor idempotency decorators (P7-07).
- [ ] Remove direct port calls from use cases (P7-08).
- [ ] Verify behavior (hit/miss/invalidation/replay/BUSY/KEY_MISMATCH/tenant isolation)
      (P7-09).
- [ ] Add tests (P7-10).

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
- No use case injects cache/idempotency ports (architecture test in Phase 9).
