# platform/outbox — Transactional Outbox

> The only sanctioned way to cross a process boundary from a business
> transaction: domain events are INSERTed as `outbox_messages` rows in the
> same DB transaction as the aggregate change; a dispatcher ships them
> afterwards (at-least-once).

## What it does

1. **Append** (`OutboxPort.append(request)`) — called by command use cases
   *inside* their `@Transactional()`. Stores event type, version, payload,
   metadata (`eventId`, `organizationId`, `correlationId`, `causationId`,
   `claimToken`), and a `tenantId` column from CLS.
2. **Append batch** (`OutboxPort.appendMany(requests)`) — batch variant for
   multi-event use cases, persisted atomically.
3. **Claim + dispatch** (`OutboxDispatcherAdapter`) — race-safe claim via
   `UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED)` of due
   `PENDING|FAILED` rows (`attempts < max`, `availableAt <= now`), stamping
   `PUBLISHING` + `claimToken` + `claimedAt` lease and bumping `attempts`.
   Broker fan-out is decided per event by `MessageRoutingPolicy`; events are
   grouped per aggregate so each aggregate's stream keeps FIFO order.
4. **In-process re-dispatch** — rehydrates the event through the
   platform-owned `outboxEventRegistry` (business rehydrators attached as a
   composition-root delegate), restoring the persisted envelope (stable `eventId`,
   `occurredAt`, correlation/causation) and running listeners under the
   tenant's restored CLS context.
5. **CAS settlement** — `markPublished` and `markFailed` require a matching
   `claimToken`, preventing a worker from settling another worker's claim.
6. **Reconcile** — `PUBLISHING` rows whose lease (`OUTBOX_CLAIM_LEASE_MS`)
   expired (crashed dispatcher) go back to `PENDING`; `FAILED` rows retry via
   exponential `availableAt` backoff (`OUTBOX_RETRY_BACKOFF_BASE_MS * 2^n`)
   until `OUTBOX_MAX_ATTEMPTS`, then `DEAD_LETTER` (terminal, alertable).
   Cleanup deletes old `PUBLISHED` rows hourly.

Status flow: `PENDING → PUBLISHING → PUBLISHED | FAILED → … → DEAD_LETTER`.
Delivery is **at-least-once**; consumers dedupe on the stable `eventId`
header (or `platform/idempotency`).

## Public API

```ts
import { OutboxPort } from '@platform/outbox/ports/outbox.port';

// business command use cases:
await this.outbox.append({
  tenantId,
  organizationId,
  eventType: 'SalesOrderCreated',
  eventVersion: 1,
  aggregateType: 'SalesOrder',
  aggregateId: order.id,
  payload: { orderId: order.id },
  occurredAt: new Date(),
  correlationId,
  causationId,
});
```

`OutboxRepositoryPort` is platform-private — business code must not touch it.

## Layout

```
ports/
  outbox.port.ts                 — public OutboxPort (append, appendMany)
  outbox-repository.port.ts      — internal persistence contract
  outbox-writer.port.ts          — DEPRECATED alias for OutboxWriterPort

repositories/
  outbox.repository.ts           — Prisma implementation with FOR UPDATE SKIP LOCKED

usecases/
  append-outbox-event.usecase.ts          — persist one event
  append-outbox-events-batch.usecase.ts   — persist a batch
  claim-outbox-messages.usecase.ts        — race-safe batch claim
  mark-outbox-published.usecase.ts        — CAS: CLAIMED → PUBLISHED
  mark-outbox-failed.usecase.ts           — CAS: CLAIMED → FAILED / DEAD_LETTER
  release-outbox-claim.usecase.ts         — release expired claims

adapters/
  outbox-dispatcher.adapter.ts   — background dispatcher (EventBus + MessageQueue)

__testing__/
  in-memory-outbox.repository.ts — test double

outbox.types.ts                  — OutboxStatus, AppendOutboxEventRequest, OutboxMessage
outbox.service.ts                — facade implementing OutboxPort
outbox-writer.ts                 — DEPRECATED adapter (old positional-args signature)
outbox-scheduler.ts              — cron jobs for dispatch, reconciliation, cleanup
outbox-reconciliation.ts         — expired claim recovery
outbox.module.ts                 — NestJS module wiring
```

## Who calls it / how called

| Consumer                        | How                                             |
| ------------------------------- | ----------------------------------------------- |
| Business application use cases  | `OutboxPort.append()`                           |
| Business application use cases  | `OutboxPort.appendMany()`                       |
| Outbox dispatcher               | Internal repository/use cases                   |
| EventBusPort                    | Dispatcher delivery                             |
| MessageQueuePort                | Dispatcher delivery                             |
| Saga                           | Receives events through EventBus/MessageQueue   |
| Background workers              | Internal dispatcher                             |

Business modules do not interact directly with the dispatcher.

## Data & config

`outbox_messages` (prisma/schema/platform/outbox.prisma). Config namespace
`outbox.*` → `ConfigService.getOutbox()`; env: `OUTBOX_POLL_INTERVAL_MS`,
`OUTBOX_BATCH_SIZE`, `OUTBOX_MAX_ATTEMPTS`, `OUTBOX_RETRY_BACKOFF_BASE_MS`,
`OUTBOX_RETRY_MAX_DELAY_MS`, `OUTBOX_CLAIM_LEASE_MS`,
`OUTBOX_CLEANUP_OLDER_THAN_HOURS`.

## Tenancy behaviour

`tenantId` and `organizationId` stamped at append from CLS and carried on
re-dispatch context. Rows are global-claimable by design (the dispatcher
is stateless); the broker envelope + headers are what consumers filter on.

## Rules & gotchas

- Publishing NEVER runs inside the business transaction; writing DOES:
  append must share the mutation's `TransactionHost` (always call from a
  `@Transactional()` use case, or the row commits outside the change).
- A status write failing after successful broker delivery only widens the
  lease window (re-delivery later); the dispatcher deliberately does not
  markFailed on publish-status errors.
- New domain event types must be added to the aggregate's rehydrator
  registry, or in-process listeners silently skip (warn-logged).
- Every state-changing operation uses CAS with `claimToken`.
- Claims have a finite lease; expired claims are reconciled.
- Failed messages use bounded retries; exhausted messages become `DEAD_LETTER`.
- `eventId` is globally unique and stable through delivery for consumer dedup.
- Event versions are explicit for schema evolution.
