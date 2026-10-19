# Platform — Idempotency Service

## 1. Purpose

Safe retry of the same operation request: the first call executes, repeats
replay the stored result. Postgres owns the claims; Redis speeds up replays.

| Concern | Handled here |
|---|---|
| Claim ledger (`idempotency_keys`) | ✅ `PrismaIdempotencyRepository` |
| Result replay cache | ✅ `RedisIdempotencyCacheAdapter` |
| HTTP + programmatic API | `IdempotencyPort`, `@Idempotent()` |
| Business modules talk to | `IdempotencyPort` only |

## 2. API

```ts
const claim = await this.idempotency.reserve({
  tenantId, organizationId, scope: 'sales.order.create', key: idempotencyKey,
});
if (claim.status === 'REPLAY') return claim.result;
if (claim.status === 'BUSY') throw new ConflictException();          // 409
if (claim.status === 'KEY_MISMATCH') throw new BadRequestException(); // 400
try {
  const result = await this.createOrder();
  await this.idempotency.complete({ reservation: claim.reservation, result });
  return result;
} catch (error) {
  await this.idempotency.fail({ reservation: claim.reservation });
  throw error;
}
```

Result statuses: `ACQUIRED` · `REPLAY + result` · `BUSY` · `KEY_MISMATCH`.

## 3. Layout

```
src/platform/idempotency/
├── ports/
│   └── idempotency.port.ts                 # the only port
├── services/
│   └── idempotency.service.ts              # implements IdempotencyPort
├── repositories/
│   └── prisma-idempotency.repository.ts    # concrete class, no internal port
├── adapters/
│   └── redis-idempotency-cache.adapter.ts  # COMPLETED results only
├── usecases/
│   ├── reserve-idempotency.usecase.ts
│   ├── complete-idempotency.usecase.ts
│   └── fail-idempotency.usecase.ts
├── http/
│   ├── idempotent.decorator.ts
│   └── idempotency.interceptor.ts
├── idempotency.reconciliation.ts           # hourly purge
├── idempotency.types.ts
├── idempotency.module.ts
└── README.md
prisma/schema/platform/idempotency.prisma
src/config/idempotency.config.ts
```

## 4. Flow

1. `reserve` checks the Redis result key — HIT returns `REPLAY` without Postgres.
2. MISS: INSERT-as-claim on the unique identity → `ACQUIRED`.
3. `COMPLETED` with the same hash → `REPLAY`; different hash → `KEY_MISMATCH`.
4. `IN_PROGRESS` with a live claim lease → `BUSY`.
5. Expired claim lease → CAS takeover with a fresh token → `ACQUIRED`.
6. `complete` CASes `IN_PROGRESS → COMPLETED` on id + token + version, then
   writes the result to Redis with the row's remaining TTL.
7. `fail` CAS-deletes the row and evicts the Redis key — no parking lot.

## 5. Data

| Store | What it holds |
|---|---|
| PostgreSQL `idempotency_keys` | claim (`IN_PROGRESS`) + completed result + `expiresAt` |
| Redis `idempotency:{tenant}:{organizationId}:{scope}:{key}` | COMPLETED result, TTL copied from the row |

Statuses are only `IN_PROGRESS | COMPLETED`. Same key in another tenant or
company is a different record.

## 6. Config (`src/config/idempotency.config.ts`)

| Env | Default | Meaning |
|---|---|---|
| `IDEMPOTENCY_TTL_MS` | `86400000` | replay window |
| `IDEMPOTENCY_CLAIM_LEASE_MS` | `300000` | live-claim window before takeover |
| `IDEMPOTENCY_REDIS_PREFIX` | `idempotency` | result key prefix |

## 7. Rules

- Client-driven retries only: `BUSY` → 409, `KEY_MISMATCH` → 400, `REPLAY`
  returns the byte-identical original.
- `fail()` releases immediately; crashed claims are taken over after the lease.
- Keys are operation-scoped, never business ids.
- IN_PROGRESS claims live only in Postgres; only COMPLETED results are cached,
  so cache and row expire together.
- The hourly reconciler deletes expired IN_PROGRESS and COMPLETED rows.
