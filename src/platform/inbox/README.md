# platform/inbox — Consumer-Side Deduplication

> The consumer counterpart of Outbox: the same logical message plus the same
> consumer yields exactly one business execution under at-least-once
> redelivery. No business rules, no broker knowledge.

## What it does

Inject `InboxPort` at the top of every broker or event consumer. **Only
`ACQUIRED` proceeds to the listener.**

1. **receive** — INSERT-as-claim on `(tenantId, organizationId, consumer,
   messageId)`. A unique-constraint violation means the row already exists:
   `PROCESSED` → `DUPLICATE`, `SUSPENDED` → `BUSY`, `IN_PROGRESS` not due for
   retry → `BUSY`. An `IN_PROGRESS` row whose retry is due is CAS re-claimed on
   its stored `claimToken` (`attempts + 1`) → `ACQUIRED`.
2. **complete** — CAS `IN_PROGRESS → PROCESSED` on the claim token. The broker
   ACK fires only after this.
3. **fail** — keeps the row `IN_PROGRESS` with an exponential `nextAttemptAt`
   and a `lastError`; the broker NACK drives redelivery, and `receive` re-claims
   once due.
4. **reconcile** (`InboxReconciler`, 60s) — an expired `IN_PROGRESS` claim with
   `attempts > INBOX_MAX_ATTEMPTS` parks `SUSPENDED` (alertable, never purged);
   the rest get a fresh backoff. The same sweep deletes `PROCESSED` rows past
   `INBOX_PROCESSED_RETENTION_MS`.

Statuses: `IN_PROGRESS | PROCESSED | SUSPENDED`. Identity is tenant + company +
consumer + message id, with NULLs normalized to `''` at the repository edge.

## Public API

```ts
import { InboxPort } from '@platform/inbox/ports/inbox.port';

const delivery = await this.inbox.receive({
  consumer: 'inventory.reserve',
  messageId: message.headers['event-id'],
  messageType: message.eventType,
  payload: message.payload,
});
if (delivery.status !== 'ACQUIRED') return;
await this.requestContext.run(requestIds, async () => {
  try {
    await this.reserveUseCase.execute(message.payload);
    await this.inbox.complete({ reservation: delivery.reservation });
  } catch (error) {
    await this.inbox.fail({ reservation: delivery.reservation, lastError: String(error) });
    throw error;
  }
});
```

`InboxPort` is the ONLY inbox port. There is **no internal repository port** —
`PrismaInboxRepository` is a concrete class injected directly into the use cases.

## Layout

```
ports/
  inbox.port.ts                      — the only port (receive/complete/fail)
repositories/
  prisma-inbox.repository.ts         — concrete: insert-as-claim, CAS, sweep
services/
  inbox.service.ts                   — facade implementing InboxPort
usecases/
  receive-inbox-message.usecase.ts
  complete-inbox-message.usecase.ts
  fail-inbox-message.usecase.ts
inbox.types.ts                       — identity, requests, reservation, result
inbox-reconciliation.ts              — @Cron sweep (suspend + backoff + purge)
inbox.module.ts                      — wiring
```

## Who calls it / how called

| Consumer                            | How                                          |
| ----------------------------------- | -------------------------------------------- |
| Broker / event listeners            | `InboxPort.receive` → guard → `complete`/`fail` |
| `InboxReconciler`                   | internal sweep + retention purge             |

Business modules consume only `InboxPort`. Events a consumer produces leave via
the **Outbox** in the same transaction.

## Data & config

`inbox_messages` (`prisma/schema/platform/inbox.prisma`). Config namespace
`inbox.*` → `ConfigService.getInbox()`; env: `INBOX_CLAIM_LEASE_MS`,
`INBOX_MAX_ATTEMPTS`, `INBOX_RETRY_BASE_DELAY_MS`, `INBOX_RETRY_MAX_DELAY_MS`,
`INBOX_RECONCILIATION_INTERVAL_MS`, `INBOX_PROCESSED_RETENTION_MS`.

## Tenancy behaviour

`(tenantId, organizationId, consumer, messageId)` is the identity, so the same
`messageId` is independently processed by different consumers and never shared
across companies.

## Rules & gotchas

- **Acknowledge in order**: broker ACK only after `inbox.complete`; `fail`
  triggers NACK + redelivery.
- Listeners stay **re-runnable** — the same message can arrive twice around a
  crash, so guard side effects accordingly.
- **Poison is parked, not dropped**: past max attempts it waits `SUSPENDED` for
  alert + manual recovery. `PROCESSED` rows purge past retention; `SUSPENDED`
  rows never do.
- **Inbox vs Idempotency**: Inbox dedupes broker redelivery by
  tenant+company+consumer+messageId and stops; Idempotency dedupes client
  retries by tenant+company+scope+key and replays the stored result.
