import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { Global, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { SqsModule } from '@ssut/nestjs-sqs';
import { KafkaConsumerHost } from './kafka/kafka-consumer.host';
import { KafkaPublisherAdapter } from './kafka/kafka-publisher.adapter';
import { KafkaService } from './kafka/kafka.service';
import { RabbitMqPublisher, KafkaPublisher, SqsPublisher } from './message-publisher.tokens';
import { RabbitMQConfigFactory } from './rabbitmq/rabbitmq-config.factory';
import { RabbitMQPublisherAdapter } from './rabbitmq/rabbitmq-publisher.adapter';
import { SqsConfigFactory } from './sqs/sqs-config.factory';
import { SqsPublisherAdapter } from './sqs/sqs-publisher.adapter';

@Global()
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

    EventEmitterModule.forRoot({ wildcard: true, delimiter: '.', maxListeners: 50 }),
  ],
  providers: [
    RabbitMQConfigFactory,
    SqsConfigFactory,
    KafkaService,
    KafkaConsumerHost,
    KafkaPublisherAdapter,
    RabbitMQPublisherAdapter,
    SqsPublisherAdapter,
    { provide: RabbitMqPublisher, useExisting: RabbitMQPublisherAdapter },
    { provide: KafkaPublisher, useExisting: KafkaPublisherAdapter },
    { provide: SqsPublisher, useExisting: SqsPublisherAdapter },
  ],
  exports: [
    KafkaPublisher,
    RabbitMqPublisher,
    SqsPublisher,
    KafkaService,
    RabbitMQConfigFactory,
    SqsConfigFactory,
  ],
})
export class MessagingModule {}
