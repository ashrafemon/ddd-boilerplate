# platform/outbox — Transactional Outbox

> The only sanctioned way to cross a process boundary from a business
> transaction: domain events are INSERTed as `outbox_messages` rows in the
> same DB transaction as the aggregate change; a publisher ships them
> afterwards (at-least-once).

## What it does

1. **Append** (`OutboxWriterPort.append(event, aggregateType, aggregateId)`)
   — called by command use cases *inside* their `@Transactional()`. Stores
   class-name eventType, payload minus envelope fields, headers
   (`event-id`, `request-id`, `correlation-id`, `causation-id`, `tenant-id`,
   `organization-id`), and a `tenantId` column straight from CLS.
2. **Claim + publish** (`OutboxPublisher`) — race-safe claim via
   `UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED)` of due
   `PENDING|FAILED` rows (`attempts < max`, `nextRetryAt <= now`), stamping
   `PUBLISHING` + `claimedAt` lease and bumping `attempts` in one statement.
   Broker fan-out is decided per event by `MessageRoutingPolicy`; events are
   grouped per aggregate so each aggregate's stream keeps FIFO order.
3. **In-process re-dispatch** — rehydrates the event through the
   platform-owned `outboxEventRegistry` (business rehydrators attached as a
   composition-root delegate), restoring the persisted envelope (stable `eventId`,
   `occurredAt`, correlation/causation) and running listeners under the
   tenant's restored CLS context.
4. **Reconcile** — `PUBLISHING` rows whose lease (`OUTBOX_CLAIM_LEASE_MS`)
   expired (crashed publisher) go back to `PENDING`; `FAILED` rows retry via
   exponential `nextRetryAt` (`OUTBOX_RETRY_BACKOFF_BASE_MS * 2^n`) until
   `OUTBOX_MAX_ATTEMPTS`, then `DEAD_LETTER` (terminal, alertable). Cleanup
   deletes old `PUBLISHED` rows hourly.

Status flow: `PENDING → PUBLISHING → PUBLISHED | FAILED → … → DEAD_LETTER`.
Delivery is **at-least-once**; consumers dedupe on the stable `event-id`
header (or `platform/idempotency`).

## Public API

```ts
import { OutboxWriterPort } from '@platform/outbox/ports/outbox-writer.port';
// business command use cases:
await this.outbox.append(event, 'Product', product.id.value);
```

`OutboxRepository` (port) is platform-private — business code must not touch it.

## Layout

```
ports/outbox-writer.port.ts / outbox-repository.port.ts
outbox-writer.ts / outbox-publisher.ts / outbox-scheduler.ts
repositories/outbox.repository.ts (Prisma + claim SQL)
```

## Who calls it / how called

- Every command use case in all 5 business aggregates + `platform/recurring`
  (occurrence-requested event) — inject `OutboxWriterPort` via `PlatformModule`.
- `OutboxScheduler` (interval publish / lease reconcile / hourly cleanup) is
  wired by `OutboxModule` — no external caller.

## Data & config

`outbox_messages` (prisma/schema/platform/outbox.prisma). Config namespace
`outbox.*` → `ConfigService.getOutbox()`; env: `OUTBOX_POLL_INTERVAL_MS`,
`OUTBOX_BATCH_SIZE`, `OUTBOX_MAX_ATTEMPTS`, `OUTBOX_RETRY_BACKOFF_BASE_MS`,
`OUTBOX_CLAIM_LEASE_MS`, `OUTBOX_CLEANUP_OLDER_THAN_HOURS`.

## Tenancy behaviour

`tenantId` stamped at append from CLS and carried on re-dispatch context.
Rows are global-claimable by design (the publisher is stateless); the broker
envelope + headers are what consumers filter on.

## Rules & gotchas

- Publishing NEVER runs inside the business transaction; writing DOES:
  append must share the mutation's `TransactionHost` (always call from a
  `@Transactional()` use case, or the row commits outside the change — and
  `@Transactional()` on the repo save path is what makes that detectable).
- A status write failing after successful broker delivery only widens the
  lease window (re-delivery later); the publisher deliberately does not
  markFailed on publish-status errors.
- New domain event types must be added to the aggregate's rehydrator
  registry, or in-process listeners silently skip (warn-logged).
