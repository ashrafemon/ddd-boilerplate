import { Module } from '@nestjs/common';
import { RabbitMqClientModule as InfraRabbitMqModule } from '@infrastructure/rabbitmq/rabbitmq.module';
import { RabbitMQPublisherAdapter } from './adapters/rabbitmq-publisher.adapter';
import { RabbitMqConsumerAdapter } from './adapters/rabbitmq-consumer.adapter';
import { MessageConsumerPort } from './ports/message-consumer.port';
import { MessageQueueAdapter } from './adapters/message-queue.adapter';
import { MessageQueuePort } from './ports/message-queue.port';
import { PublishMessageUseCase } from './use-cases/publish-message.usecase';

/**
 * Platform messaging module — one publish-only inbound port
 * (`MessageQueuePort`) over the broker client initialised by the
 * infrastructure layer.
 *
 * The broker client has its own module under `@infrastructure`; this module
 * owns the port bindings and the broker routing only. No business consumers
 * here: Rabbit listeners subscribe themselves.
 *
 * Broker routing stays conditional on `envelope.broker` even though this
 * deployment ships RabbitMQ only — the outbox envelope still carries the field
 * and `PublishMessageUseCase` rejects a target this deployment cannot serve
 * with `UnsupportedBrokerTargetError` (the outbox parks that row as FAILED
 * instead of retrying, so a leftover Kafka/SQS envelope can never spin the
 * dispatcher).
 */
@Module({
  imports: [InfraRabbitMqModule],
  providers: [
    // Outbound adapter → the configured broker driver
    RabbitMQPublisherAdapter,

    // Use case
    PublishMessageUseCase,

    // Inbound driver + port implementation
    MessageQueueAdapter,
    { provide: MessageQueuePort, useExisting: MessageQueueAdapter },

    // Inbound consumption seam: subscribers register routing keys, not clients
    RabbitMqConsumerAdapter,
    { provide: MessageConsumerPort, useExisting: RabbitMqConsumerAdapter },
  ],
  exports: [MessageQueuePort, MessageConsumerPort],
})
export class MessagingModule {}
