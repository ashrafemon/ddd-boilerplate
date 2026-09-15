# platform/events — In-process bus + broker routing policy

> Two tiny decisions live here: how a rehydrated domain event reaches
> in-process listeners, and which brokers an event fans out to.

## What it does

- `InProcessEventBus` (bound to `NestEventBusAdapter`): emits on
  `event.constructor.name` over `EventEmitter2` (wildcard `.`-delimited,
  provided by `@infrastructure/messaging`'s EventEmitterModule root).
  Business `@OnEvent('<EventClassName>')` listeners are wired to the
  outbox's in-process re-dispatch — the bus itself never publishes brokers.
- `MessageRoutingPolicy` (`DefaultMessageRoutingPolicy`): resolves an
  eventType to broker targets. Everything goes to `rabbitmq`; the
  five `*-requested/created` fan-out events listed in the file also target
  `kafka`/`sqs`. Disabled brokers (unset `KAFKA_BROKERS` / `SQS_URL`) are
  skipped at the adapter, so a message still marks published — the routing
  list names *intent*, availability gates the legs.

## Public API

```ts
import { InProcessEventBus } from '@platform/events/ports/event-bus.port';
import { MessageRoutingPolicy } from '@platform/events/message-routing.policy';
```

Both are consumed **only** by `platform/outbox/outbox-publisher.ts`.

## Layout / who calls / data

`events.module.ts`, `adapters/nest-event-bus.adapter.ts`,
`message-routing.policy.ts`. No tables, no config, no lifecycle hooks.

## Tenancy behaviour

None — routing is event-type based. The event envelope carries tenancy via
outbox headers instead.

## Rules & gotchas

- **Adding a broker listener means adding the event to
  `FAN_OUT_EVENTS`.** That list is the single source of truth for topology.
- In-process listeners fire during the outbox publish tick: keep them
  idempotent (redelivery happens) and never throw synchronously in
  `publish()` (the publisher wraps dispatch and log-only degrades).
- Events must be registered in the aggregate's domain-event rehydrator
  registry to survive rehydration.
