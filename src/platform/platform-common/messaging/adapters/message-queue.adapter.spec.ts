import { OutboxEnvelope } from '@platform/platform-common/outbox/types/outbox.types';
import { MessageQueueAdapter } from './message-queue.adapter';
import { PublishMessageUseCase } from '../use-cases/publish-message.usecase';

/**
 * Unit — the inbound adapter is pure delegation; routing lives in the use case.
 */
describe('MessageQueueAdapter', () => {
  const envelope: OutboxEnvelope = {
    eventId: 'evt-1',
    eventType: 'OrderCreated',
    aggregateType: 'PurchaseOrder',
    aggregateId: 'order-1',
    payload: {},
    occurredAt: new Date(),
  };

  it('forwards the envelope to the publish use case', async () => {
    const execute = jest.fn<Promise<void>, [OutboxEnvelope]>();
    execute.mockResolvedValue(undefined);
    const adapter = new MessageQueueAdapter({ execute } as unknown as PublishMessageUseCase);

    await adapter.publish(envelope);

    expect(execute).toHaveBeenCalledWith(envelope);
  });
});
