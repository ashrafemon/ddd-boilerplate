import { ConfigService } from '@config/config.service';
import { MessageHandlerErrorBehavior } from '@golevelup/nestjs-rabbitmq';

/**
 * Builds the RabbitMQ connection options from the typed config facade. A plain
 * function (not an injectable) so `RabbitMQModule.forRootAsync` can receive it
 * while only injecting the global ConfigService.
 */
export function buildRabbitMQOptions(config: ConfigService) {
  const rabbitMqConfig = config.getRabbitMQ();

  return {
    uri: rabbitMqConfig.url,
    registerHandlers: rabbitMqConfig.registerHandlers,
    exchanges: [
      {
        name: rabbitMqConfig.exchange ?? 'erp.events',
        type: 'topic' as const,
        options: { durable: true },
      },
    ],
    connectionInitOptions: { wait: false, timeout: 10_000 },
    defaultSubscribeErrorBehavior: MessageHandlerErrorBehavior.NACK,
    defaultPublishOptions: { persistent: true },
  };
}
