import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { ConfigService } from '@config/config.service';
import {
  BrokerMessageHandler,
  BrokerSubscription,
  MessageConsumerPort,
} from '../ports/message-consumer.port';

interface ActiveSubscription {
  consumerTag: string;
  key: string;
}

/**
 * RabbitMQ adapter for `MessageConsumerPort`.
 *
 * Registers dynamic subscribers on the connection the infrastructure layer
 * already owns (`AmqpConnection.createSubscriber`), so a platform module can
 * subscribe to a routing key without importing a broker client and without a
 * decorator that has to be known at class-definition time.
 *
 * Ack policy: the handler resolving acks the message; a throw nacks it without
 * requeue — the producer's outbox (or the owning state machine's lease) is the
 * retry path, which keeps a poison message from spinning a queue forever. A
 * different policy can be chosen per subscription later without touching callers.
 *
 * Startup policy: the connection is opened with `wait: false`, so on a broker
 * that is down `createSubscriber` awaits a channel forever and would block
 * `app.init()`. Subscription setup is therefore bounded by
 * `messaging.connectTimeoutMs`; on expiry the subscription is logged and left
 * inactive instead of hanging boot (same policy as `KafkaConsumerHost`).
 */
@Injectable()
export class RabbitMqConsumerAdapter implements MessageConsumerPort, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqConsumerAdapter.name);
  private readonly exchange: string;
  private readonly connectTimeoutMs: number;
  private readonly active = new Map<string, ActiveSubscription>();

  constructor(
    private readonly amqp: AmqpConnection,
    config: ConfigService,
  ) {
    this.exchange = config.getRabbitMQ().exchange;
    this.connectTimeoutMs = config.getMessaging().connectTimeoutMs;
  }

  async subscribe(subscription: BrokerSubscription, handler: BrokerMessageHandler): Promise<void> {
    const key = `${subscription.queue}|${subscription.routingKey}`;
    if (this.active.has(key)) {
      this.logger.debug(`Subscription ${key} already active`);
      return;
    }

    let expired = false;
    const subscriber = this.amqp.createSubscriber(
      async (body: unknown) => {
        await handler(body);
      },
      {
        exchange: this.exchange,
        routingKey: subscription.routingKey,
        queue: subscription.queue,
        queueOptions: { durable: subscription.durable ?? true },
      },
      subscription.queue,
    );

    // A channel that opens after the budget expired must not stay registered:
    // nobody awaits it, so cancel it as soon as it arrives.
    void subscriber
      .then(async ({ consumerTag }) => {
        if (expired) await this.amqp.cancelConsumer(consumerTag);
      })
      .catch(() => undefined);

    let timer: NodeJS.Timeout | undefined;
    const budget = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        expired = true;
        reject(new Error(`no broker channel within ${this.connectTimeoutMs}ms`));
      }, this.connectTimeoutMs);
    });

    try {
      const { consumerTag } = await Promise.race([subscriber, budget]);
      this.active.set(key, { consumerTag, key });
      this.logger.log(
        `Subscribed ${subscription.queue} to ${subscription.routingKey} on ${this.exchange}`,
      );
    } catch (err) {
      this.logger.error(
        `Subscription ${key} inactive: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async onModuleDestroy(): Promise<void> {
    for (const subscription of this.active.values()) {
      try {
        await this.amqp.cancelConsumer(subscription.consumerTag);
      } catch (err) {
        this.logger.warn(
          `Could not cancel ${subscription.key}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    this.active.clear();
  }
}
