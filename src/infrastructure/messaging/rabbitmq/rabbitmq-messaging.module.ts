import { Module } from '@nestjs/common';
import {
  MessageHandlerErrorBehavior,
  RabbitMQModule,
} from '@golevelup/nestjs-rabbitmq';
import {
  ERP_EVENTS_DEAD_LETTER_EXCHANGE,
  ERP_EVENTS_EXCHANGE,
} from '../../../platform/messaging/messaging.constants';
import { ConfigurationService } from '../../../config/configuration.service';
import { MessagingCoreModule } from '../../../platform/messaging/messaging-core.module';
import { RabbitMqPublisherAdapter } from './rabbitmq-publisher.adapter';
import { ErpRabbitMqConsumer } from './rabbitmq-consumer.service';

/**
 * RabbitMQ infrastructure. Connection is lazy (`wait: false`) so the
 * application bootstraps even when the broker is temporarily unavailable and
 * reconnects automatically.
 */
@Module({
  imports: [
    MessagingCoreModule,
    RabbitMQModule.forRootAsync({
      useFactory: (configuration: ConfigurationService) => ({
        uri: configuration.getRabbitMq().url,
        exchanges: [
          { name: ERP_EVENTS_EXCHANGE, type: 'topic', options: { durable: true } },
          {
            name: ERP_EVENTS_DEAD_LETTER_EXCHANGE,
            type: 'topic',
            options: { durable: true },
          },
        ],
        connectionInitOptions: { wait: false, timeout: 10_000 },
        defaultSubscribeErrorBehavior: MessageHandlerErrorBehavior.NACK,
        defaultPublishOptions: { persistent: true },
      }),
      inject: [ConfigurationService],
    }),
  ],
  providers: [RabbitMqPublisherAdapter, ErpRabbitMqConsumer],
  exports: [RabbitMqPublisherAdapter],
})
export class RabbitMqMessagingModule {}
