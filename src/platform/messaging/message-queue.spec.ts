import { randomUUID } from 'crypto';
import { InMemoryMessageQueue } from './__testing__/in-memory-message-queue';
import { MessageConsumerRegistry } from './consumers/message-consumer.registry';
import { PublishMessageUseCase } from './usecases/publish-message.usecase';
import { SubscribeMessageUseCase } from './usecases/subscribe-message.usecase';
import { AcknowledgeMessageUseCase } from './usecases/acknowledge-message.usecase';
import { RejectMessageUseCase } from './usecases/reject-message.usecase';
import { MessageQueueService } from './message-queue.service';

describe('MessageQueueService', () => {
  let mq: InMemoryMessageQueue;
  let publish: PublishMessageUseCase;
  let subscribe: SubscribeMessageUseCase;
  let ack: AcknowledgeMessageUseCase;
  let nack: RejectMessageUseCase;
  let service: MessageQueueService;

  beforeEach(() => {
    mq = new InMemoryMessageQueue();
    publish = new PublishMessageUseCase(mq);
    subscribe = new SubscribeMessageUseCase(mq);
    ack = new AcknowledgeMessageUseCase(mq);
    nack = new RejectMessageUseCase(mq);
    service = new MessageQueueService(publish, subscribe, ack, nack);
  });

  it('publishes a message', async () => {
    const result = await service.publish({
      messageId: randomUUID(),
      destination: 'orders',
      messageType: 'OrderCreated',
      messageVersion: 1,
      payload: { orderId: 'order-1' },
    });

    expect(result.accepted).toBe(true);
    expect(result.messageId).toBeDefined();
    expect(mq.getPublished()).toHaveLength(1);
  });

  it('subscribes to a destination', async () => {
    const handler = jest.fn().mockResolvedValue(undefined);
    const subscription = await service.subscribe({
      destination: 'orders',
      messageType: 'OrderCreated',
      messageVersion: 1,
      handler,
    });

    expect(subscription.subscriptionId).toBeDefined();
    expect(subscription.destination).toBe('orders');
  });

  it('acks a message', async () => {
    const subId = 'sub-1';
    await service.ack({ messageId: 'msg-1', subscriptionId: subId });

    expect(mq.getAcked()).toHaveLength(1);
    expect(mq.getAcked()[0].messageId).toBe('msg-1');
  });

  it('nacks a message', async () => {
    const subId = 'sub-1';
    await service.nack({ messageId: 'msg-1', subscriptionId: subId, requeue: true });

    expect(mq.getNacked()).toHaveLength(1);
    expect(mq.getNacked()[0].requeue).toBe(true);
  });

  it('preserves tenant metadata through publish', async () => {
    await service.publish({
      messageId: randomUUID(),
      destination: 'orders',
      messageType: 'OrderCreated',
      messageVersion: 1,
      payload: { orderId: 'order-1' },
      tenantId: 'tenant-001',
      organizationId: 'org-001',
      correlationId: 'corr-123',
      causationId: 'cause-456',
    });

    const published = mq.getPublished()[0];
    expect(published.tenantId).toBe('tenant-001');
    expect(published.organizationId).toBe('org-001');
    expect(published.correlationId).toBe('corr-123');
    expect(published.causationId).toBe('cause-456');
  });

  it('subscription handler receives messages', async () => {
    const handler = jest.fn().mockResolvedValue(undefined);
    const subscription = await service.subscribe({
      destination: 'orders',
      messageType: 'OrderCreated',
      messageVersion: 1,
      handler,
    });

    await mq.deliver(subscription.subscriptionId, {
      messageId: 'msg-1',
      messageType: 'OrderCreated',
      messageVersion: 1,
      payload: { orderId: 'order-1' },
      deliveryAttempt: 1,
      receivedAt: new Date(),
    });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ messageId: 'msg-1' }),
    );
  });

  it('unsubscribe removes subscription', async () => {
    const handler = jest.fn().mockResolvedValue(undefined);
    const subscription = await service.subscribe({
      destination: 'orders',
      messageType: 'OrderCreated',
      messageVersion: 1,
      handler,
    });

    await subscription.unsubscribe();

    // After unsubscribe, delivering should be a no-op
    await mq.deliver(subscription.subscriptionId, {
      messageId: 'msg-1',
      messageType: 'OrderCreated',
      messageVersion: 1,
      payload: {},
      deliveryAttempt: 1,
      receivedAt: new Date(),
    });

    expect(handler).not.toHaveBeenCalled();
  });
});

describe('MessageConsumerRegistry', () => {
  let registry: MessageConsumerRegistry;

  beforeEach(() => {
    registry = new MessageConsumerRegistry();
  });

  it('registers and retrieves subscriptions', () => {
    const sub = {
      subscriptionId: 'sub-1',
      destination: 'orders',
      unsubscribe: jest.fn(),
    };

    registry.register(sub);
    expect(registry.count()).toBe(1);
    expect(registry.get('sub-1')).toBe(sub);
  });

  it('unregisters subscriptions', () => {
    const sub = {
      subscriptionId: 'sub-1',
      destination: 'orders',
      unsubscribe: jest.fn(),
    };

    registry.register(sub);
    registry.unregister('sub-1');
    expect(registry.count()).toBe(0);
    expect(registry.get('sub-1')).toBeUndefined();
  });

  it('gets all subscriptions', () => {
    registry.register({
      subscriptionId: 'sub-1',
      destination: 'orders',
      unsubscribe: jest.fn(),
    });
    registry.register({
      subscriptionId: 'sub-2',
      destination: 'invoices',
      unsubscribe: jest.fn(),
    });

    expect(registry.getAll()).toHaveLength(2);
  });

  it('shutdown calls unsubscribe on all', async () => {
    const unsub1 = jest.fn();
    const unsub2 = jest.fn();

    registry.register({ subscriptionId: 'sub-1', destination: 'a', unsubscribe: unsub1 });
    registry.register({ subscriptionId: 'sub-2', destination: 'b', unsubscribe: unsub2 });

    await registry.shutdown();

    expect(unsub1).toHaveBeenCalled();
    expect(unsub2).toHaveBeenCalled();
    expect(registry.count()).toBe(0);
  });
});
