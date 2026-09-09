import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { Module } from '@nestjs/common';
import { SqsModule } from '@ssut/nestjs-sqs';
import { KafkaService } from '@infrastructure/messaging/kafka/kafka.service';
import { RabbitMQConfigFactory } from '@infrastructure/messaging/rabbitmq/rabbitmq-config.factory';
import { SqsConfigFactory } from '@infrastructure/messaging/sqs/sqs-config.factory';
import { KafkaPublisherAdapter } from './adapters/kafka-publisher.adapter';
import { RabbitMQPublisherAdapter } from './adapters/rabbitmq-publisher.adapter';
import { SqsPublisherAdapter } from './adapters/sqs-publisher.adapter';
import { MessagePublisher } from './ports/message-publisher.port';
import { RabbitMqPublisher, KafkaPublisher, SqsPublisher } from './message-publisher.tokens';

@Module({
  imports: [
    RabbitMQModule.forRootAsync({
      inject: [RabbitMQConfigFactory],
      useFactory: (factory: RabbitMQConfigFactory) => factory.createRabbitMQOptions(),
    }),

    SqsModule.registerAsync({
      inject: [SqsConfigFactory],
      useFactory: (factory: SqsConfigFactory) => factory.createSqsOptions(),
    }),
  ],
  providers: [
    RabbitMQConfigFactory,
    SqsConfigFactory,
    KafkaService,
    KafkaPublisherAdapter,
    RabbitMQPublisherAdapter,
    SqsPublisherAdapter,
    { provide: MessagePublisher, useExisting: RabbitMQPublisherAdapter },
    { provide: RabbitMqPublisher, useExisting: RabbitMQPublisherAdapter },
    { provide: KafkaPublisher, useExisting: KafkaPublisherAdapter },
    { provide: SqsPublisher, useExisting: SqsPublisherAdapter },
  ],
  exports: [
    MessagePublisher,
    RabbitMqPublisher,
    KafkaPublisher,
    SqsPublisher,
    KafkaService,
    RabbitMQConfigFactory,
    SqsConfigFactory,
  ],
})
export class MessagingModule {}
