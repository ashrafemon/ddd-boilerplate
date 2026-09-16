# platform/messaging — Broker publisher adapters

> Thin per-broker implementations of `MessagePublisher`. One adapter per
> transport; the outbox publisher decides targets via `MessageRoutingPolicy`.

## What it does

Publishes the identical `IntegrationMessage` envelope
(`{ eventType, aggregateType, aggregateId, payload, headers, occurredAt }`)
to:

| Token | Adapter | Shape | Degradation |
| --- | --- | --- | --- |
| `RabbitMqPublisher` | RabbitMQ | routing key = eventType on configured `rabbitmq.exchange`, persistent | required (infra AmqpConnection) |
| `KafkaPublisher` | Kafka | topic = eventType, key = aggregateId | disabled when `KAFKA_BROKERS` unset |
| `SqsPublisher` | SQS | queue URL target, `event-id` header as message id | silent no-op without `SQS_URL` |
| `MessagePublisher` | → RabbitMQ (default binding) | — | currently unused token; kept as the generic seam |

## How called

`platform/outbox/outbox-publisher.ts` injects all three dec
(`@Inject(RabbitMqPublisher)` …) and `platform/scheduler/rabbitmq-scheduler-event.publisher.ts`
injects `RabbitMqPublisher` for the unregistered-jobType fallback. Business
code never publishes directly — events reach brokers only through the outbox.

## Layout / data

`ports/` (message-publisher + IntegrationMessage type),
`message-publisher.tokens.ts` (marker tokens), `adapters/` (the three
adapters), `messaging.module.ts`. No tables; config via infra clients
(`getRabbitMQ()`, `getSqs()` — `messaging.config.ts`).

## Rules & gotchas

- A publish leg failing throws → the outbox marks the message FAILED and
  retries; partial delivery across brokers is expected (at-least-once +
  consumer dedupe on `event-id`).
- New broker: implement `MessagePublisher.bindings.publish`, register a
  token here, add the target to `BrokerTarget` + routing policy — do not
  hand-roll producers inside business modules (lint blocks broker
  libraries outside infra/listeners).
