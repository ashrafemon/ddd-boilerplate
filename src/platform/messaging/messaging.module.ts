import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@config/config.module';
import { SqsModule } from '@ssut/nestjs-sqs';
import { KafkaService } from '@infrastructure/messaging/kafka/kafka.service';
import { RabbitMQConfigFactory } from '@infrastructure/messaging/rabbitmq/rabbitmq-config.factory';
import { KafkaPublisherAdapter } from './adapters/kafka-publisher.adapter';
import { RabbitMQPublisherAdapter } from './adapters/rabbitmq-publisher.adapter';
import { SqsPublisherAdapter } from './adapters/sqs-publisher.adapter';
import { MessagePublisher } from './ports/message-publisher.port';
import { RabbitMqPublisher, KafkaPublisher, SqsPublisher } from './message-publisher.tokens';
import { ConfigService } from '@config/config.service';

@Module({
  imports: [
    RabbitMQModule.forRootAsync({
      inject: [ConfigService, RabbitMQConfigFactory],
      useFactory: (factory: RabbitMQConfigFactory, config: ConfigService) =>
        factory.createRabbitMQOptions(config),
    }),

    SqsModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: any) => {
        const sqs = config.get('messaging.sqs', {
          url: '',
          region: 'us-east-1',
        });
        if (!sqs.url) {
          return { consumers: [], producers: [] };
        }
        return {
          consumers: [{ name: 'consumer1', queueUrl: sqs.url, region: sqs.region }],
          producers: [{ name: 'producer1', queueUrl: sqs.url, region: sqs.region }],
        };
      },
    }),
  ],
  providers: [
    RabbitMQConfigFactory,
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
  ],
})
export class MessagingModule {}
