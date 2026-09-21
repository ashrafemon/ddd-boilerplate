# Platform — Distributed Lock Service

## 1. Purpose

Cross-instance mutual exclusion — the platform primitive that lets every
service (scheduler, workers, request handlers) run "exactly one instance of
this work right now" without duplicating Redis client setup or lock-key
conventions.

| Concern | Handled here |
|---|---|
| Redis lock ownership (SET NX PX + Lua) | ✅ `RedisDistributedLockAdapter` |
| PostgreSQL fencing token sequence | ✅ `PrismaDistributedLockRepository` |
| Key structure & tenant isolation | ✅ `LockKeyBuilder` |
| Business modules talk to | `DistributedLockPort` only |

Business modules never import Redis, write lock keys, or construct fencing
logic.  They inject the port and control the sequence:

```
1. acquire() → ACQUIRED / BUSY
2. execute operation
3. renew() → RENEWED / LOST  (long-running only)
4. execute operation
5. release()
```

---

## 2. Architecture

```
Business Module
       │
       ▼
DistributedLockPort          ← abstract class, injected
       │
       ▼
DistributedLockService       ← facade, one-liner per use case
       │
       ├──── AcquireUseCase  → RedisLockPort (SET NX PX)
       │                       DistributedLockRepositoryPort (fencing token)
       │
       ├──── RenewUseCase    → RedisLockPort (ownership check + PEXPIRE)
       │
       └──── ReleaseUseCase  → RedisLockPort (ownership check + DEL)
```

**Data stores:**

| Store | What it holds | Why |
|---|---|---|
| Redis | Active lock ownership (key → owner token, PX TTL) | Sub-ms atomic operations, lease expiry |
| PostgreSQL | Fencing token sequence per lock resource | Durable monotonic counter, survives Redis restart |

---

## 3. File Structure

```
src/platform/locking/
├── locking.types.ts                          # Types
├── lock-key.builder.ts                       # Deterministic key builder
├── distributed-lock.service.ts               # Facade
├── locking.module.ts                         # NestJS module
├── README.md
│
├── ports/
│   ├── distributed-lock.port.ts              # Public port
│   ├── distributed-lock-repository.port.ts   # Repository port (PostgreSQL)
│   └── redis-lock.port.ts                    # Redis lock operations port
│
├── adapters/
│   ├── redis-distributed-lock.adapter.ts     # Redis implementation
│   └── redis-distributed-lock.adapter.spec.ts
│
├── repositories/
│   └── prisma-distributed-lock.repository.ts # PostgreSQL implementation
│
├── usecases/
│   ├── acquire-distributed-lock.usecase.ts
│   ├── renew-distributed-lock.usecase.ts
│   └── release-distributed-lock.usecase.ts
│
├── __testing__/
│   └── in-memory-distributed-lock.adapter.ts
│
└── __tests__/
    └── distributed-lock.service.spec.ts

prisma/schema/platform/
└── locking.prisma                            # DistributedLock table
```

---

## 4. Lock Identity

Every lock is identified by the tuple:

```
(tenantId, organizationId, scope, resource)
```

The `LockKeyBuilder` produces a deterministic string:

```
{tenantId}:{organizationId}:{scope}:{resource}
```

Example:
```
tenant-001:company-001:inventory.stock:product-123:warehouse-001
```

The adapter prepends `lock:` → Redis key: `lock:tenant-001:company-001:inventory.stock:product-123:warehouse-001`.

---

## 5. How to Use

### Import the module

```ts
// feature.module.ts
import { LockingModule } from '@platform/locking/locking.module';

@Module({
  imports: [LockingModule],
})
export class FeatureModule {}
```

### Inject the port

```ts
import { DistributedLockPort } from '@platform/locking/ports/distributed-lock.port';

@Injectable()
export class InventorySyncHandler {
  constructor(private readonly lockPort: DistributedLockPort) {}

  async handle(productId: string): Promise<void> {
    const result = await this.lockPort.acquire({
      tenantId: 'tenant-001',
      organizationId: 'org-001',
      scope: 'inventory.stock',
      resource: productId,
      leaseMs: 30_000,
    });

    if (result.status === 'BUSY') {
      // Another instance is processing this product — skip.
      return;
    }

    try {
      await this.syncInventory(productId);
    } finally {
      await this.lockPort.release({ ticket: result.ticket });
    }
  }
}
```

### Long-running operations (with renew)

```ts
async processLargeBatch(batchId: string): Promise<void> {
  const result = await this.lockPort.acquire({
    tenantId: 'tenant-001',
    organizationId: 'org-001',
    scope: 'batch.process',
    resource: batchId,
    leaseMs: 60_000,
  });

  if (result.status === 'BUSY') return;

  const renewInterval = setInterval(async () => {
    const renewed = await this.lockPort.renew({
      ticket: result.ticket,
      leaseMs: 60_000,
    });
    if (renewed.status === 'LOST') {
      clearInterval(renewInterval);
      // Lock lost — stop processing
    }
  }, 30_000);

  try {
    await this.processItems(batchId);
  } finally {
    clearInterval(renewInterval);
    await this.lockPort.release({ ticket: result.ticket });
  }
}
```

---

## 6. Failure Semantics

| Scenario | Behavior | Rationale |
|---|---|---|
| Redis down | acquire → BUSY | Fail closed — caller skips work |
| Redis error during acquire | BUSY (logged) | Fail closed |
| Redis error during release | Silently ignored | Best effort — lock expires via TTL |
| Owner token mismatch (renew) | LOST | Another instance took over |
| Owner token mismatch (release) | Silently ignored | Best effort |
| PostgreSQL down during acquire | Exception propagates | Fencing token is critical — cannot safely acquire without it |

---

## 7. Fencing Tokens

Every acquire atomically increments a PostgreSQL counter for the lock resource.
The returned fencing token lets downstream resources (databases, external APIs)
reject stale operations from an expired lock holder.

```
Acquire 1 → fencingToken = 1
Release
Acquire 2 → fencingToken = 2
```

If instance A holds fencing token 1 and its lease expires, instance B acquires
fencing token 2.  Any write from A with token 1 can be rejected by the
downstream resource.

---

## 8. Do NOT

| Mistake | Why |
|---|---|
| Inject `RedisService` directly | Bypasses tenant isolation and fencing tokens |
| Build lock keys manually | Use `LockKeyBuilder` or the port — keys must be deterministic |
| Use locks as cache | Locks expire; cache has `CachePort` for that |
| Use locks as session store | Session store is a different primitive |
| Forget to release in `finally` | Leaked locks block other instances until TTL |
| Skip PostgreSQL for fencing | Redis alone cannot provide durable monotonic tokens |

---

## 9. Configuration

Environment variables (with defaults):

```bash
# Distributed Lock
LOCK_DEFAULT_LEASE_MS=30000     # Default lock lease (ms)
LOCK_MIN_LEASE_MS=5000          # Minimum allowed lease
LOCK_MAX_LEASE_MS=300000        # Maximum allowed lease
LOCK_RENEW_INTERVAL_MS=10000    # Recommended renew check interval
```

---

## 10. Testing

Use `InMemoryDistributedLockAdapter` for unit tests:

```ts
import { InMemoryDistributedLockAdapter } from '@platform/locking/__testing__/in-memory-distributed-lock.adapter';

const lock = new InMemoryDistributedLockAdapter();

const result = await lock.acquire({
  tenantId: 't1', organizationId: 'o1',
  scope: 'test', resource: 'item-1',
});

expect(result.status).toBe('ACQUIRED');
```
