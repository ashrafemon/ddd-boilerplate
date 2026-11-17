import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { KafkaModule as InfraKafkaModule } from '@infrastructure/kafka/kafka.module';
import { RabbitMqClientModule as InfraRabbitMqModule } from '@infrastructure/rabbitmq/rabbitmq.module';
import { SqsClientModule as InfraSqsModule } from '@infrastructure/sqs/sqs.module';
import { KafkaPublisherAdapter } from './adapters/kafka-publisher.adapter';
import { KafkaConsumerHost } from './adapters/kafka-consumer.host';
import { RabbitMQPublisherAdapter } from './adapters/rabbitmq-publisher.adapter';
import { SqsPublisherAdapter } from './adapters/sqs-publisher.adapter';
import { MessageQueuePort } from './ports/message-queue.port';
import { MessageQueueService } from './services/message-queue.service';
import { PublishMessageUseCase } from './usecases/publish-message.usecase';
import { RabbitMqPublisher, KafkaPublisher, SqsPublisher } from './message-publisher.tokens';

/**
 * Platform messaging module — one publish-only port (`MessageQueuePort`) bound
 * to the broker clients initialised by the infrastructure layer. Each driver
 * client has its own module under `@infrastructure`; this module only owns the
 * port bindings and the broker routing. No consumers, no subscribe registry.
 */
@Module({
  imports: [DiscoveryModule, InfraRabbitMqModule, InfraKafkaModule, InfraSqsModule],
  providers: [
    KafkaConsumerHost,
    KafkaPublisherAdapter,
    RabbitMQPublisherAdapter,
    SqsPublisherAdapter,
    { provide: RabbitMqPublisher, useExisting: RabbitMQPublisherAdapter },
    { provide: KafkaPublisher, useExisting: KafkaPublisherAdapter },
    { provide: SqsPublisher, useExisting: SqsPublisherAdapter },
    PublishMessageUseCase,
    MessageQueueService,
    { provide: MessageQueuePort, useExisting: MessageQueueService },
  ],
  exports: [MessageQueuePort],
})
export class MessagingModule {}
