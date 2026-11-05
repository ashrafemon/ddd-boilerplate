# ERP Boilerplate — Outbox, Events & Messaging

This document describes the transactional outbox, domain events, integration events, broker
selection, and listener patterns.

## Transactional outbox

Every state-changing use case runs inside `@Transactional()` and appends each raised domain
event to the outbox **in the same DB transaction** as the aggregate change:

```
use case → <Aggregate>IntegrationPort → OutboxAdapter → OutboxWriterPort (platform)
```

### Flow

1. **Aggregate raises events** — domain methods call `this.addEvent(event)`.
2. **Use case drains events** — `aggregate.pullEvents()` returns and clears the event queue.
3. **Events appended to outbox** — `IntegrationPort.send(event, aggregateId)` calls
   `OutboxWriterPort.append()` which builds the canonical envelope and saves it via
   `PrismaOutboxRepository` on the caller's `TransactionHost`.
4. **Transaction commits** — aggregate state change and outbox rows commit atomically.
5. **Scheduler publishes** — `OutboxScheduler` ticks, `PublishPendingBatchUseCase` claims
   due rows via `FOR UPDATE SKIP LOCKED`, publishes to `MessageQueuePort`, emits on
   `InProcessEventBus`, and CAS-settles.

### Canonical envelope

All transports carry the same envelope:

```ts
{
  eventId: string;           // stable, consumer dedupes on this
  eventType: string;         // domain event class name (e.g. 'ProductCreated')
  aggregateType: string;     // e.g. 'Product'
  aggregateId: string;       // aggregate root id
  payload: Record<string, unknown>;  // domain event payload (minus envelope fields)
  headers: {
    'event-id': string;
    'correlation-id': string;
    'causation-id': string;
    'tenant-id': string;
    'broker': string;
  };
  occurredAt: string;        // ISO timestamp
}
```

### OutboxWriterPort.append()

```ts
append(event, aggregateType, aggregateId, opts?): Promise<void>
```

Builds the envelope (`eventType` = domain event class name, headers from
`RequestContextPort`, `opts.broker` defaulting to `rabbitmq`) and saves via
`PrismaOutboxRepository` on the caller's `TransactionHost`.

### PublishPendingBatchUseCase

Driven by `OutboxScheduler`:

- `claimBatch(batchSize, maxAttempts, claimLeaseMs)` — single `UPDATE … WHERE id IN
  (SELECT … FOR UPDATE SKIP LOCKED)` over due `PENDING` rows
  (`nextRetryAt <= now`, claim older than the lease). Stamps `claimToken` + `claimedAt`
  and increments `attempts` **without changing status**.
- Each claimed record is published to `MessageQueuePort` (broker by `envelope.broker`),
  emitted on `InProcessEventBus` under a restored tenant CLS context, and CAS-settled.
- Delivery order is claim order (`createdAt` asc).

### OutboxScheduler

- Dispatch tick on `OUTBOX_POLL_INTERVAL_MS` (default 10s).
- Hourly `cleanup()` deletes `PUBLISHED` rows older than `cleanupOlderThanHours`.
- No reconciler — a crashed owner's lease expires and the next tick reclaims the row.

### Statuses and retries

| Status | Meaning |
|--------|---------|
| `PENDING` | Awaiting publish |
| `PUBLISHED` | Successfully published |
| `DEAD_LETTER` | Terminal — `attempts` exceeded `OUTBOX_MAX_ATTEMPTS` |

- Publish error keeps the row `PENDING` with exponential backoff (`nextRetryAt`).
- Delivery is **at-least-once**; consumers dedupe on the stable `event-id`.
- In-process (`@OnEvent`) delivery is best-effort: a listener exception is logged, never
  reflected onto the row (the broker already holds the message).
- Publishing is **never** inside the business transaction. Business code only writes;
  the scheduler owns delivery.
- An unconfigured broker target throws so the row retries; Kafka without `KAFKA_BROKERS`
  / SQS without `SQS_URL` park rather than silently drop.

## Domain events vs integration events

| | Domain event | Integration event |
|---|-------------|-------------------|
| Scope | In-process, same monolith | Across brokers/processes |
| Transport | `InProcessEventBus` (EventEmitter2) | RabbitMQ / Kafka / SQS |
| Durability | Best effort | Transactional outbox (at-least-once) |
| Persisted | No | `outbox_messages` |
| Example | `ProductCreated` → `@OnEvent` listener | Same event published as canonical `OutboxEnvelope` |

Each module's `integrations/publishes/*.integration-event.ts` files declare the typed wire
shape per event (`eventType: 'product.created'`, etc.) as a publish contract. The outbox
serializes the domain event payload under the event class name.

## Broker selection

One messaging port: `MessageQueuePort.publish(envelope)`. The `broker` field on the canonical
envelope picks the transport (default `rabbitmq`); `opts.broker` on
`OutboxWriterPort.append` sets it at write time.

| Transport | Configuration |
|-----------|---------------|
| RabbitMQ | `RABBITMQ_URL`, exchange `erp.events`, routing key = event type |
| Kafka | `KAFKA_BROKERS`, `KAFKA_CLIENT_ID`, `KAFKA_GROUP_ID`, topic = event type |
| SQS | `SQS_URL`, `SQS_REGION`, `SQS_CREDENTIALS`, configured queue |

There is **no routing table** — a new consumer transport means a new listener, and an
unconfigured broker target throws so the outbox retries.

## Listeners

Listeners live in
`business/<context>/<module>/application/integrations/listeners/` — one class per transport
per module:

| File pattern | Decorator | Transport |
|-------------|-----------|-----------|
| `*.rabbitmq.listener-event.ts` | `@RabbitSubscribe` | RabbitMQ (durable queue, routing key = event type) |
| `*.kafka.listener-event.ts` | `@KafkaEvent('<EventType>')` | Kafka (custom decorator, discovered via `DiscoveryService`) |
| `*.sqs.listener-event.ts` | `@SqsMessageHandler('consumer1')` | SQS (`@ssut/nestjs-sqs`) |
| `*.event-emitter.listener-event.ts` | `@OnEvent('<EventType>')` | In-process (receives canonical envelope; `message.payload` is business payload) |

### Listener contract

Handlers must:

1. Receive the envelope and extract `tenantId`/`companyId` from `envelope.headers`.
2. Run `RequestContextPort.run({ tenantId, companyId }, ...)` to restore CLS context.
3. Call `InboxPort.receive()` — insert-as-claim on `(tenant, company, consumer, messageId)`.
4. If status is `ACQUIRED`, delegate to a use case/facade.
5. Call `InboxPort.complete()` on success or `InboxPort.fail()` on error.
6. Never run business logic inline — always delegate to use cases/facades.

## Inbox (consumer-side dedupe)

`InboxPort` provides:

- `receive(options)` — insert-as-claim on `(tenantId, companyId, consumer, messageId)`;
  returns `{ status: 'ACQUIRED' | 'DUPLICATE' | 'FAILED', reservation }`.
- `complete({ reservation })` — mark the message as fully processed.
- `fail({ reservation, lastError })` — mark the message as failed with the error message.

Per-minute reconciler parks exhausted messages in `SUSPENDED`.

## Integration events per module

| Module | Events |
|--------|--------|
| Product | `ProductCreated`, `ProductUpdated`, `ProductActivated`, `ProductDeactivated`, `ProductDiscontinued` |
| Vendor | `VendorCreated`, `VendorUpdated`, `VendorActivated`, `VendorDeactivated`, `VendorBlocked` |
| PurchaseOrder | `PurchaseOrderCreated`, `PurchaseOrderSubmitted`, `PurchaseOrderApproved`, `PurchaseOrderRejected`, `PurchaseOrderIssued`, `PurchaseOrderCancelled`, `PurchaseOrderCompleted`, `PurchaseOrderAmended`, `LineAdded`, `LineRemoved` |
| GoodReceiptNote | `GrnCreated`, `GrnLineAdded`, `GrnReceived`, `GrnCompleted`, `GrnCancelled`, `GoodsReceiptPosted`, `GoodsReceiptReversed` |
| Invoice | `InvoiceCreated`, `InvoicePosted`, `InvoicePaid` |
