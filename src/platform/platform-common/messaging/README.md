# platform/messaging — One Port, Broker by Param

> Infrastructure-agnostic async transport after an outbox row is ready. **One
> public port**; the envelope's `broker` field picks rabbitmq, kafka or sqs.
> Knows exchanges/topics/queues; knows nothing about domain semantics.

## What it does

`MessageQueuePort.publish(envelope)` routes on `envelope.broker` (default
`rabbitmq`) across three adapters:

| Token | Adapter | Shape | Degradation |
| --- | --- | --- | --- |
| `RabbitMqPublisher` | RabbitMQ | routing key = `eventType` on `rabbitmq.exchange`, persistent | required (infra AmqpConnection) |
| `KafkaPublisher` | Kafka | topic = `eventType`, key = `aggregateId` | **throws** when `KAFKA_BROKERS` unset |
| `SqsPublisher` | SQS | configured queue URL | **throws** when `SQS_URL` unset |

An unconfigured broker target throws, so the outbox keeps the row `PENDING` and
retries it to `DEAD_LETTER` — a missing broker never blocks a transaction.

The identical canonical envelope (`OutboxEnvelope` from
`platform/outbox/outbox.types`) goes to every transport, so consumers are
portable. Headers carry `event-id`, correlation, causation and tenant.

## Public API

```ts
import { MessageQueuePort } from '@platform/messaging/ports/message-queue.port';

// normally called by the outbox publisher, not business code
await this.messageQueue.publish(envelope); // broker: 'rabbitmq' | 'kafka' | 'sqs'
```

`BrokerPublisher` and the `RabbitMqPublisher`/`KafkaPublisher`/`SqsPublisher`
marker tokens are internal to the module.

## Layout

```
ports/
  message-queue.port.ts          — the only publisher port
services/
  message-queue.service.ts       — facade implementing MessageQueuePort
usecases/
  publish-message.usecase.ts     — switches on envelope.broker across adapters
adapters/
  rabbitmq-publisher.adapter.ts
  kafka-publisher.adapter.ts
  sqs-publisher.adapter.ts
message-publisher.tokens.ts      — BrokerPublisher contract + DI tokens
messaging.module.ts
```

No `consumers/`, no subscribe registry.

## Who calls it / how called

| Consumer                    | How                                     |
| --------------------------- | --------------------------------------- |
| `platform/outbox`           | `publish(envelope)` during the tick     |
| `platform/scheduler`        | `publish(envelope)` for unregistered jobTypes |

Business code never publishes directly — events reach brokers only through the
outbox. Consumers live **in business** (`@RabbitSubscribe` / `@KafkaEvent` /
`@SqsMessageHandler`), then `platform/inbox`, the use case, then ack.

## Data / config

No tables. Config via `messaging.config.ts` → `getRabbitMQ()`, `getKafka()`,
`getSqs()`; env `RABBITMQ_URL`, `RABBITMQ_EXCHANGE`, `KAFKA_BROKERS` (optional),
`SQS_URL`/`SQS_REGION` (optional), `MESSAGE_QUEUE_PUBLISH_TIMEOUT_MS`.

## Rules & gotchas

- Business never imports amqplib/kafkajs/sqs libs (ESLint).
- At-least-once; consumers dedupe via Inbox + the stable `event-id`.
- Same envelope on every broker; tenant/correlation headers preserved.
- New broker: implement `BrokerPublisher`, register a token here, add the value
  to `BrokerTarget` and the publish switch — never hand-roll producers inside
  business modules.
