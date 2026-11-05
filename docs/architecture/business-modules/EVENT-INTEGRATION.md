# Event Integration

> Normative companion to [`ARCHITECTURE-RULES.md`](./ARCHITECTURE-RULES.md) §6
> (R-26…R-31, R-45) and §4 (R-44). Covers incoming contracts/listeners with
> Inbox-first sequencing, event access boundaries, outgoing contracts/publishers,
> unavailable integrations, organization/naming, and tests.
> Repo-wide outbox rules remain in force (`ARCHITECTURE.md` §8, `AGENTS.md` INH-03).

---

## 1. Direction and folder layout

Incoming and outgoing integrations MUST be separate. The current repo uses
`application/integrations/listens/` (note: **`listens`**, not `listeners`) and
`application/integrations/publishes/`.

```text
application/integrations/
├── listens/                                  # INCOMING
│   ├── <event>.listener-event.ts             # contract (plain wire shape)
│   ├── <event>.listener.ts                   # in-process @OnEvent
│   ├── <event>.rabbitmq.listener-event.ts    # RabbitMQ @RabbitSubscribe
│   ├── <event>.kafka.listener-event.ts       # @KafkaEvent
│   ├── <event>.sqs.listener-event.ts         # @SqsMessageHandler
│   └── ...
└── publishes/                                # OUTGOING
    ├── <module>.publisher-port.ts            # abstract integration/outbox port
    └── <event>.publisher-event.ts            # per-event wire shape (JSON-safe)
```

Rules:

- One contract file and one listener implementation per incoming event; do not group
  multiple event handlers into one file unless they are the same event/transport.
- One publisher file per outgoing event, plus the module's publisher port.
- Contracts are plain data (no domain classes, no behavior).
- Naming is stable and explicit: include the event name and transport in listener file
  names; publishers use `<event>.publisher-event.ts`.
- **Event access boundary (R-44).** Event contracts are application-layer plain types.
  An incoming contract may be imported only by its dedicated listener (and the inbound
  port that carries it). An outgoing contract may be imported only by its dedicated
  publisher (and the outbound port that carries it). Domain events remain domain-only;
  application/presentation code must not import domain event classes. A use case may
  hand the aggregate's drained events to a publisher port as opaque values, but must not
  import, inspect, or build domain event classes itself.
- **Platform envelope exception.** The platform's structural `OutboxEvent` envelope is a
  transport type, not a domain event. It is permitted only at the publisher/outbox-port
  boundary (and the outbox adapter), never as a domain/application event carried through
  controllers or use cases.

---

## 2. Incoming events

### 2.1 Required listener sequence (R-28/R-29)

```ts
async onEvent(envelope: EventContract): Promise<void> {
  // 1. receive the event (transport decorator delivers the canonical envelope/payload)

  // 2. Inbox check BEFORE any business work
  const delivery = await this.inbox.receive({
    tenantId: envelope.tenantId,
    companyId: envelope.companyId,
    consumer: '<stable-consumer-name>',
    messageId: envelope.eventId ?? envelope.messageId,
    messageType: envelope.eventType,
    payload: envelope.payload,
    correlationId: envelope.correlationId,
    causationId: envelope.causationId,
  });

  // 3. only ACQUIRED proceeds; DUPLICATE/BUSY stop without re-running the use case
  if (delivery.status !== 'ACQUIRED') return;

  // 4. invoke the corresponding use case
  try {
    await this.useCase.execute(envelope.aggregateId, envelope.payload);
    await this.inbox.complete({ reservation: delivery.reservation });
  } catch (error) {
    await this.inbox.fail({
      reservation: delivery.reservation,
      lastError: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
```

Mandatory properties:

1. The Inbox check MUST happen **before** the use case is invoked.
2. A duplicate/already-processed event MUST NOT re-run the use case.
3. The consumer name MUST be stable per logical consumer (not per deployment/instance).
4. The dedupe key MUST be the stable event/message id (the outbox `eventId` for
   business events); at-least-once redelivery must not double-apply.
5. On failure, the reservation must be failed/released so retry semantics are explicit.
6. Listeners MUST NOT contain business logic, repository/domain access, or calculations;
   they delegate to a use case.
7. Listeners are the only business code allowed to import broker subscribe decorators;
   they must not use raw clients.

### 2.2 Broker vs. in-process

- **Every** incoming listener follows the sequence above, including in-process
  `@OnEvent`, log-only, and observational listeners. There is no exemption: if the
  transport can redeliver, the listener claims the Inbox before doing anything else.
- The outbox emits the **canonical envelope verbatim**; there is no rehydration step.
  Listeners read the business payload from the envelope (`message.payload`).

### 2.3 Current state and gap

- Existing listeners live in `application/integrations/listens/**`.
- Most are template/logging listeners (`GoodsReceiptPostedListener`,
  `RecurringOccurrenceRequestedRabbitMQListener`) and do **not** call the Inbox or a
  use case. This is a confirmed Phase 6 gap, not an approved pattern.
- The platform `InboxPort` exists (`src/platform/platform-common/inbox/`) but is not
  used by business listeners today.

---

## 3. Outgoing events

### 3.1 Structure

- `<module>.publisher-port.ts` — abstract class = DI token, e.g.
  `send(event: OutboxEvent, aggregateId: string): Promise<void>`.
- `<event>.publisher-event.ts` — plain JSON-safe wire contract for the event.
- `<event>.publisher.ts` (when a dedicated publisher is needed) — publishes through the
  integration/outbox port; separate from use-case business logic.
- `infrastructure/adapters/platform/outbox.adapter.ts` — implements the publisher port
  by calling `OutboxWriterPort.append(event, aggregateType, aggregateId)` inside the
  use case's transaction.

### 3.2 Rules

- Publishing MUST go through the outbox inside the caller's `@Transactional()`
  boundary; never publish directly from a use case or controller (INH-03).
- The publisher/publishing step MUST be separate from business logic/calculations.
- One publisher per event keeps payload construction and routing auditable.
- Use `opts.broker` only when a non-default broker is required; default is `rabbitmq`.
- The payload is persisted/delivered verbatim; no rehydration registry exists.
- Domain events raised by aggregates are drained by the use case/application service and
  handed to the publisher/integration port; the use case must not build broker messages
  inline.

### 3.3 Current state

- Publisher ports exist (`*.publisher-port.ts`) and are bound to `OutboxAdapter`.
- `purchase-order.released.publisher-event.ts` exists; audit coverage per event in
  Phase 6.
- Some use cases drain events directly after save; this remains orchestration, but the
  publisher boundary must stay separate from business logic (audit in P6-08/P6-09).
  The use case must pass drained events opaquely to the publisher port; it must not
  import domain event classes (R-44).

### 3.4 Unavailable modules and integrations (R-45)

Some modules and integrations required by business flows are not available yet. They
are **not** an invitation to implement or recreate them inside a business module.

- Define the outbound **port** (abstract class = DI token) and the plain **contract**
  the business module needs. The business module injects and invokes the port.
- Do not create a fake/stub implementation that pretends the integration exists, and do
  not copy the unavailable module's logic into the business module.
- Keep the orchestration stable: a later adapter can implement the port without changing
  the use case, publisher, or listener.
- For an unavailable **incoming** integration, define the event contract and the use-case
  entry point; deliver the listener/adapter when the integration becomes available. Do
  not add a listener that silently drops events or fakes processing.
- For an unavailable **outgoing** integration, define the publisher port/contract; the
  adapter may be a deferred implementation. Tests use a test double for the port, not a
  production fake.
- Inventory the unavailable capabilities and their ports in Phase 6 (`P6-12`); record
  the list in `PROGRESS.md`.

---

## 4. Consumer and event-contract conventions

| Artifact | Convention | Example |
| --- | --- | --- |
| Incoming contract | `<event>.listener-event.ts`, plain shape | `goods-receipt-posted.listener.event.ts` |
| In-process listener | `<event>.listener.ts` | `goods-receipt-posted.listener.ts` |
| Rabbit listener | `<event>.rabbitmq.listener-event.ts` | `recurring-occurrence-requested.rabbitmq.listener-event.ts` |
| Kafka listener | `<event>.kafka.listener-event.ts` | — |
| SQS listener | `<event>.sqs.listener-event.ts` | — |
| Outgoing port | `<module>.publisher-port.ts` | `purchase-order.publisher-port.ts` |
| Outgoing contract | `<event>.publisher-event.ts` | `purchase-order.released.publisher-event.ts` |
| Outbox adapter | `outbox.adapter.ts` | `infrastructure/adapters/platform/outbox.adapter.ts` |

Canonical envelope (platform): `eventId`, `eventType`, `eventVersion?`, `tenantId?`,
`companyId?`, `aggregateType`, `aggregateId`, `payload`, `headers?`, `occurredAt`,
`correlationId?`, `causationId?`, `broker?`.

---

## 5. Idempotency and duplicate handling

- Delivery is at-least-once; duplicates are expected.
- Dedupe on the stable `eventId` (or provider message id for inbound webhooks) through
  the Inbox; do not rely on in-memory sets or timing.
- The Inbox claim must be insert-as-claim on `(tenant, company, consumer, messageId)`
  with a lease; terminal completion/failure must be CAS/token-fenced.
- A duplicate must be a no-op (no side effect, no second domain transition).
- Listeners must be safe to re-run after a crash: the Inbox lease/claim state decides
  whether to process, wait, or take over.

---

## 6. Tests required (Phase 6/9)

1. Every incoming event has a contract and a dedicated listener.
2. Inbox check occurs before the use case (assert ordering; duplicate delivery produces
   one effect).
3. A duplicate/already-processed event does not re-run the use case.
4. A failed handler releases/fails the reservation and can be retried.
5. Outgoing events are published through the outbox port inside the transaction; no
   direct broker publish.
6. One publisher file per event; payload is JSON-safe and stable.
7. In-process envelope is the canonical one; listeners read `message.payload`.
8. An unconfigured broker parks/retries rather than silently dropping.
9. Event classes/contracts are used only by their explicit listener/publisher/port; no
   domain event imports outside the domain (R-44).
10. An unavailable integration is represented by a port/contract, not a fake or
    recreated module (R-45).
