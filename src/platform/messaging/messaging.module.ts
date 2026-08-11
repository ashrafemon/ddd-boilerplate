import { DynamicModule, Module, Type } from '@nestjs/common';
import { envBoolean } from '../../config/env-helpers';
import { KafkaConsumerService } from '../../infrastructure/messaging/kafka/kafka-consumer.service';
import { KafkaPublisherAdapter } from '../../infrastructure/messaging/kafka/kafka-publisher.adapter';
import { MessagingCoreModule } from './messaging-core.module';
import { RabbitMqMessagingModule } from '../../infrastructure/messaging/rabbitmq/rabbitmq-messaging.module';
import { SqsConsumerService } from '../../infrastructure/messaging/sqs/sqs-consumer.service';
import { SqsPublisherAdapter } from '../../infrastructure/messaging/sqs/sqs-publisher.adapter';

/**
 * Aggregates the message transports enabled by configuration. Each transport
 * is an independent module with its own provider-specific infrastructure.
 */
@Module({})
export class MessagingModule {
  public static forRoot(): DynamicModule {
    const imports: Array<Type | DynamicModule> = [MessagingCoreModule];

    if (envBoolean('RABBITMQ_ENABLED', false)) {
      imports.push(RabbitMqMessagingModule);
    }

    if (envBoolean('KAFKA_ENABLED', false)) {
      imports.push(KafkaModule);
    }

    if (envBoolean('SQS_ENABLED', false)) {
      imports.push(SqsModule);
    }

    return {
      module: MessagingModule,
      global: true,
      imports,
    };
  }
}

@Module({
  imports: [MessagingCoreModule],
  providers: [KafkaPublisherAdapter, KafkaConsumerService],
  exports: [KafkaPublisherAdapter],
})
class KafkaModule {}

@Module({
  imports: [MessagingCoreModule],
  providers: [SqsPublisherAdapter, SqsConsumerService],
  exports: [SqsPublisherAdapter],
})
class SqsModule {}
