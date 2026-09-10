import { ConfigService } from '@config/config.service';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { SqsModule } from '@ssut/nestjs-sqs';
import { KafkaConsumerHost } from './kafka/kafka-consumer.host';
import { KafkaService } from './kafka/kafka.service';
import { buildRabbitMQOptions } from './rabbitmq/rabbitmq-config.factory';
import { buildSqsOptions } from './sqs/sqs-config.factory';

/**
 * Infrastructure messaging module — only client initialization/setup.
 *
 * Registers the in-process event emitter, RabbitMQ, SQS and the Kafka
 * client/consumer host. Option builders are plain functions that receive the
 * global ConfigService, so no provider declared here has to leak into a
 * third-party module context.
 */

@Module({
  imports: [
    DiscoveryModule,
    EventEmitterModule.forRoot({ wildcard: true, delimiter: '.', maxListeners: 50 }),
    RabbitMQModule.forRootAsync({
      inject: [ConfigService],
      useFactory: buildRabbitMQOptions,
    }),
    SqsModule.registerAsync({
      inject: [ConfigService],
      useFactory: buildSqsOptions,
    }),
  ],
  providers: [KafkaService, KafkaConsumerHost],
  exports: [EventEmitterModule, RabbitMQModule, SqsModule, KafkaService],
})
export class MessagingModule {}
