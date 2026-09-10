import { Module } from '@nestjs/common';
import { MessagingModule as InfraMessagingModule } from '@infrastructure/messaging/messaging.module';
import { KafkaPublisherAdapter } from './adapters/kafka-publisher.adapter';
import { RabbitMQPublisherAdapter } from './adapters/rabbitmq-publisher.adapter';
import { SqsPublisherAdapter } from './adapters/sqs-publisher.adapter';
import { MessagePublisher } from './ports/message-publisher.port';
import { RabbitMqPublisher, KafkaPublisher, SqsPublisher } from './message-publisher.tokens';

/**
 * Platform messaging module — binds the MessagePublisher port to the broker
 * clients initialised by the infrastructure layer. Driver registration lives
 * in `@infrastructure/messaging`; this module only owns the port bindings.
 */
@Module({
  imports: [InfraMessagingModule],
  providers: [
    KafkaPublisherAdapter,
    RabbitMQPublisherAdapter,
    SqsPublisherAdapter,
    { provide: MessagePublisher, useExisting: RabbitMQPublisherAdapter },
    { provide: RabbitMqPublisher, useExisting: RabbitMQPublisherAdapter },
    { provide: KafkaPublisher, useExisting: KafkaPublisherAdapter },
    { provide: SqsPublisher, useExisting: SqsPublisherAdapter },
  ],
  exports: [MessagePublisher, RabbitMqPublisher, KafkaPublisher, SqsPublisher],
})
export class MessagingModule {}
