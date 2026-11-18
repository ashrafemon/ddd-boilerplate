import { ConfigService } from '@config/config.service';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { RabbitMqConsumerAdapter } from './rabbitmq-consumer.adapter';

/**
 * Unit — the platform's inbound consumption seam.
 *
 * Subscribers register a queue + routing key here instead of importing a broker
 * client, so the transport stays owned by the messaging module. The subscription
 * must be durable, idempotent per (queue, routingKey), and torn down on destroy.
 */
describe('RabbitMqConsumerAdapter', () => {
  function makeSut() {
    const createSubscriber = jest.fn(
      async (
        _handler: (body: unknown) => Promise<void>,
        _options: Record<string, unknown>,
        _queue: string,
      ) => ({ consumerTag: 'tag-1' }),
    );
    const cancelConsumer = jest.fn(async () => undefined);
    const amqp = { createSubscriber, cancelConsumer };
    const config = { getRabbitMQ: () => ({ exchange: 'erp.events' }) };
    const adapter = new RabbitMqConsumerAdapter(
      amqp as unknown as AmqpConnection,
      config as unknown as ConfigService,
    );
    return { adapter, createSubscriber, cancelConsumer };
  }

  it('binds a durable queue to the routing key on the configured exchange', async () => {
    const { adapter, createSubscriber } = makeSut();
    const handler = jest.fn(async () => undefined);

    await adapter.subscribe({ routingKey: 'saga.command', queue: 'saga.commands.erp' }, handler);

    expect(createSubscriber).toHaveBeenCalledWith(
      expect.any(Function),
      {
        exchange: 'erp.events',
        routingKey: 'saga.command',
        queue: 'saga.commands.erp',
        queueOptions: { durable: true },
      },
      'saga.commands.erp',
    );
  });

  it('passes the decoded body to the handler and acks by resolving', async () => {
    const { adapter, createSubscriber } = makeSut();
    const handler = jest.fn(async () => undefined);
    await adapter.subscribe({ routingKey: 'saga.command', queue: 'saga.commands.erp' }, handler);

    const [subscriber] = createSubscriber.mock.calls[0];
    await subscriber({ eventType: 'saga.command' });

    expect(handler).toHaveBeenCalledWith({ eventType: 'saga.command' });
  });

  it('nacks by propagating a handler error', async () => {
    const { adapter, createSubscriber } = makeSut();
    const handler = jest.fn(async () => {
      throw new Error('boom');
    });
    await adapter.subscribe({ routingKey: 'saga.command', queue: 'saga.commands.erp' }, handler);

    const [subscriber] = createSubscriber.mock.calls[0];
    await expect(subscriber({})).rejects.toThrow('boom');
  });

  it('is idempotent per queue and routing key', async () => {
    const { adapter, createSubscriber } = makeSut();
    const handler = jest.fn(async () => undefined);

    await adapter.subscribe({ routingKey: 'saga.command', queue: 'saga.commands.erp' }, handler);
    await adapter.subscribe({ routingKey: 'saga.command', queue: 'saga.commands.erp' }, handler);

    expect(createSubscriber).toHaveBeenCalledTimes(1);
  });

  it('cancels every subscription on destroy', async () => {
    const { adapter, cancelConsumer } = makeSut();
    const handler = jest.fn(async () => undefined);
    await adapter.subscribe({ routingKey: '#', queue: 'saga.all-events.erp' }, handler);

    await adapter.onModuleDestroy();

    expect(cancelConsumer).toHaveBeenCalledWith('tag-1');
  });
});
