import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
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
  imports: [EventEmitterModule.forRoot({ wildcard: true, delimiter: '.', maxListeners: 50 })],
  providers: [RabbitMQConfigFactory, SqsConfigFactory, KafkaService, KafkaConsumerHost],
  exports: [KafkaService, RabbitMQConfigFactory, SqsConfigFactory],
})
export class MessagingModule {}
