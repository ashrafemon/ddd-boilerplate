import { DiscoveryService } from '@nestjs/core';
import { KAFKA_EVENT_LISTENER_METADATA } from '@common/http/decorators/kafka-event.decorator';
import { KafkaService } from '@infrastructure/kafka/kafka.service';
import { KafkaConsumerHost } from './kafka-consumer.host';

/**
 * Unit — `@KafkaEvent` handler discovery and dispatch.
 *
 * The host must subscribe to exactly the topics that have handlers, survive a
 * disabled broker without crashing, and stop its consumer on shutdown. It is a
 * driver adapter: it implements no port and owns no rules beyond dispatch.
 */

/** Mirrors the real `@KafkaEvent(topic)` decorator contract. */
function KafkaEvent(topic: string): MethodDecorator {
  return (_target, _key, descriptor) => {
    Reflect.defineMetadata(KAFKA_EVENT_LISTENER_METADATA, { topic }, descriptor.value as object);
  };
}

class OrdersListener {
  public readonly received: unknown[] = [];

  @KafkaEvent('orders.created')
  handle(payload: unknown): void {
    this.received.push(payload);
  }
}

type StartConsumerArgs = Parameters<KafkaService['startConsumer']>[0];

function makeSut(options: { handlers?: boolean; enabled?: boolean } = {}) {
  const listener = new OrdersListener();
  const discovery = {
    getProviders: () =>
      options.handlers === false ? [] : [{ instance: listener, metatype: OrdersListener }],
  } as unknown as DiscoveryService;

  let onMessage: StartConsumerArgs['onMessage'] = () => Promise.resolve();
  const stop = jest.fn<Promise<void>, []>();
  stop.mockResolvedValue(undefined);
  const startConsumer = jest.fn<Promise<{ stop: typeof stop }>, [StartConsumerArgs]>();
  startConsumer.mockImplementation(args => {
    onMessage = args.onMessage;
    return Promise.resolve({ stop });
  });
  const kafkaService = {
    isEnabled: options.enabled ?? true,
    startConsumer,
  } as unknown as KafkaService;

  const host = new KafkaConsumerHost(discovery, kafkaService);

  return {
    host,
    listener,
    startConsumer,
    stop,
    deliver: (value?: string) => onMessage({ topic: 'orders.created', value: value ?? null }),
    topics: () => startConsumer.mock.calls[0]?.[0].topics,
  };
}

describe('KafkaConsumerHost', () => {
  it('subscribes to exactly the topics that have handlers', async () => {
    const { host, topics } = makeSut();

    await host.onApplicationBootstrap();

    expect(topics()).toEqual(['orders.created']);
  });

  it('does not start a consumer when no handler is registered', async () => {
    const { host, startConsumer } = makeSut({ handlers: false });

    await host.onApplicationBootstrap();

    expect(startConsumer).not.toHaveBeenCalled();
  });

  it('does not start a consumer when Kafka is disabled', async () => {
    const { host, startConsumer } = makeSut({ enabled: false });

    await host.onApplicationBootstrap();

    expect(startConsumer).not.toHaveBeenCalled();
  });

  it('delivers a parsed payload to the handler', async () => {
    const { host, listener, deliver } = makeSut();
    await host.onApplicationBootstrap();

    await deliver(JSON.stringify({ orderId: 'order-1' }));

    expect(listener.received).toEqual([{ orderId: 'order-1' }]);
  });

  it('delivers the raw string when the payload is not JSON', async () => {
    const { host, listener, deliver } = makeSut();
    await host.onApplicationBootstrap();

    await deliver('not-json');

    expect(listener.received).toEqual(['not-json']);
  });

  it('stops the consumer on shutdown', async () => {
    const { host, stop } = makeSut();
    await host.onApplicationBootstrap();

    await host.onModuleDestroy();

    expect(stop).toHaveBeenCalled();
  });
});
