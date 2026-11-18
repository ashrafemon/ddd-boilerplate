import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { KafkaModule as InfraKafkaModule } from '@infrastructure/kafka/kafka.module';
import { RabbitMqClientModule as InfraRabbitMqModule } from '@infrastructure/rabbitmq/rabbitmq.module';
import { SqsClientModule as InfraSqsModule } from '@infrastructure/sqs/sqs.module';
import { KafkaPublisherAdapter } from './outbound/adapters/kafka-publisher.adapter';
import { RabbitMQPublisherAdapter } from './outbound/adapters/rabbitmq-publisher.adapter';
import { SqsPublisherAdapter } from './outbound/adapters/sqs-publisher.adapter';
import {
  KafkaPublisherPort,
  RabbitMqPublisherPort,
  SqsPublisherPort,
} from './outbound/ports/broker-publisher.port';
import { KafkaConsumerHost } from './inbound/adapters/kafka-consumer.host';
import { MessageQueueAdapter } from './inbound/adapters/message-queue.adapter';
import { MessageQueuePort } from './inbound/ports/message-queue.port';
import { PublishMessageUseCase } from './use-cases/publish-message.usecase';

/**
 * Platform messaging module — one publish-only inbound port
 * (`MessageQueuePort`) over the broker clients initialised by the
 * infrastructure layer.
 *
 * Each driver client has its own module under `@infrastructure`; this module
 * owns the port bindings and the broker routing only. No business consumers
 * here: `KafkaConsumerHost` binds `@KafkaEvent` handlers discovered across the
 * app, and Rabbit listeners subscribe themselves.
 */
@Module({
  imports: [DiscoveryModule, InfraRabbitMqModule, InfraKafkaModule, InfraSqsModule],
  providers: [
    // Outbound adapters → one port per broker driver
    RabbitMQPublisherAdapter,
    { provide: RabbitMqPublisherPort, useExisting: RabbitMQPublisherAdapter },
    KafkaPublisherAdapter,
    { provide: KafkaPublisherPort, useExisting: KafkaPublisherAdapter },
    SqsPublisherAdapter,
    { provide: SqsPublisherPort, useExisting: SqsPublisherAdapter },

    // Use case
    PublishMessageUseCase,

    // Inbound driver + port implementation
    KafkaConsumerHost,
    MessageQueueAdapter,
    { provide: MessageQueuePort, useExisting: MessageQueueAdapter },
  ],
  exports: [MessageQueuePort],
})
export class MessagingModule {}
