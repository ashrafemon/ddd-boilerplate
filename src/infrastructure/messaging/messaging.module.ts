import { ConfigService } from '@config/config.service';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { SqsModule } from '@ssut/nestjs-sqs';
import { KafkaConsumerHost } from './kafka/kafka-consumer.host';
import { KafkaService } from './kafka/kafka.service';
import { RabbitMQConfigFactory } from './rabbitmq/rabbitmq-config.factory';
import { SqsConfigFactory } from './sqs/sqs-config.factory';

/**
 * Infrastructure messaging module — only client initialization/setup.
 *
 * Registers RabbitMQ, SQS and the event emitter. Exposes the raw
 * Kafka service and configuration factories so platform adapters can
 * publish directly through the configured clients.
 */

@Module({
  imports: [
    EventEmitterModule.forRoot({ wildcard: true, delimiter: '.', maxListeners: 50 }),
    RabbitMQModule.forRootAsync({
      inject: [RabbitMQConfigFactory, ConfigService],
      useFactory: (factory: RabbitMQConfigFactory, config: ConfigService) =>
        factory.createRabbitMQOptions(config),
    }),
    SqsModule.registerAsync({ useClass: SqsConfigFactory }),
  ],
  providers: [RabbitMQConfigFactory, SqsConfigFactory, KafkaService, KafkaConsumerHost],
  exports: [],
})
export class MessagingModule {}
