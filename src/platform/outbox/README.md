# platform/outbox — Transactional Outbox

> The only sanctioned way to cross a process boundary from a business
> transaction: domain events are INSERTed as `outbox_messages` rows in the
> same DB transaction as the aggregate change; the scheduler ships them
> afterwards (at-least-once).

## What it does

1. **Append** (`OutboxWriterPort.append(event, aggregateType, aggregateId, opts?)`)
   — called by command use cases *inside* their `@Transactional()`. Persists
   the event type, payload, the stable `eventId`, correlation/causation and a
   `tenantId`/`companyId` stamp from CLS. `opts.broker` defaults to
   `rabbitmq` and is stored in `headers.broker`.
2. **Claim + publish** (`PublishPendingBatchUseCase`, driven by
   `OutboxScheduler`) — race-safe claim via
   `UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED)` over due `PENDING`
   rows (`nextRetryAt <= now`, claim older than `OUTBOX_CLAIM_LEASE_MS`),
   stamping `claimToken` + `claimedAt` and bumping `attempts` **without changing
   status** (the lease is the in-flight marker).
3. **Publish + emit** — `MessageQueuePort.publish(envelope)` (broker by
   `envelope.broker`), then `InProcessEventBus.emit(envelope)` under the row's
   restored CLS tenant context. Same canonical envelope on both paths.
4. **CAS settlement** — `markPublished` / `markFailed` require a matching
   `claimToken`, so a worker can never settle another worker's claim.
5. **Retry / park** — publish errors keep the row `PENDING` with an exponential
   `nextRetryAt`; once `attempts` exceeds `OUTBOX_MAX_ATTEMPTS` the row parks
   `DEAD_LETTER` (terminal, never auto-deleted).
6. **Cleanup** — an hourly cron deletes `PUBLISHED` rows past retention.

Statuses: `PENDING | PUBLISHED | DEAD_LETTER`. Delivery is **at-least-once**;
consumers dedupe on the stable `eventId` header (or `platform/idempotency`).
There is **no reconciler** — a crashed owner's lease simply expires and the next
tick reclaims the row through the same claim clause.

## Public API

```ts
import { OutboxWriterPort } from '@platform/outbox/ports/outbox-writer.port';

// business command use case, inside @Transactional():
await this.outbox.append(new OrderCreated(order), 'SalesOrder', order.id);
```

`OutboxWriterPort` is the ONLY outbox port. There is no internal repository
port — `PrismaOutboxRepository` is a concrete class injected directly into the
outbox use cases.

## Layout

```
ports/
  outbox-writer.port.ts          — public port (append + opts)

repositories/
  prisma-outbox.repository.ts    — concrete Prisma repo (FOR UPDATE SKIP LOCKED)

usecases/
  append-outbox-event.usecase.ts     — persist one event inside the caller's tx
  publish-pending-batch.usecase.ts   — claim → publish → emit → CAS settle

services/
  outbox.service.ts              — facade implementing OutboxWriterPort

outbox.types.ts                  — OutboxEnvelope (canonical), OutboxMessage,
                                   OutboxStatus, OutboxEvent/OutboxEventBase
outbox.scheduler.ts              — dispatch tick + hourly retention cleanup
outbox.module.ts                 — NestJS module wiring
```

## Who calls it / how called

| Consumer                       | How                                          |
| ------------------------------ | -------------------------------------------- |
| Business/platform use cases    | `OutboxWriterPort.append(event, type, id)`   |
| `OutboxScheduler`              | internal `PublishPendingBatchUseCase`        |
| `MessageQueuePort`             | dispatcher broker delivery                   |
| `InProcessEventBus`            | dispatcher local delivery                    |

Business modules never touch the repository or the dispatcher.

## Data & config

`outbox_messages` (`prisma/schema/platform/outbox.prisma`). Config namespace
`outbox.*` → `ConfigService.getOutbox()`; env: `OUTBOX_POLL_INTERVAL_MS`,
`OUTBOX_BATCH_SIZE`, `OUTBOX_MAX_ATTEMPTS`, `OUTBOX_RETRY_BASE_DELAY_MS`,
`OUTBOX_RETRY_MAX_DELAY_MS`, `OUTBOX_CLAIM_LEASE_MS`,
`OUTBOX_CLEANUP_OLDER_THAN_HOURS`.

## Tenancy behaviour

`tenantId` and `companyId` are stamped at append from CLS and restored into
CLS before in-process re-dispatch. Rows are global-claimable by design (the
scheduler is stateless); the envelope + headers are what consumers filter on.

## Rules & gotchas

- Publishing NEVER runs inside the business transaction; writing DOES. Always
  call `append` from a `@Transactional()` use case so the row commits with the
  aggregate change.
- `append` writes nothing outside the process — it only persists a row.
- Every state write is CAS-fenced on `claimToken`; redeliveries re-run but never
  double-apply.
- In-process (`@OnEvent`) delivery is **best-effort**: a listener exception is
  logged and never pushes the row into retry (the broker already holds the
  message) — in-process reactions that must survive a crash belong behind a
  business broker consumer + `platform/inbox`.
- Consumers read the canonical envelope; `message.payload` is the business
  payload. There is no rehydration step — `eventId` is stable through delivery
  for dedup.
