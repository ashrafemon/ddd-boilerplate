import { SharedOutboxAdapter } from './shared-outbox.adapter';
import { OutboxEvent } from '../types/outbox.types';

/**
 * Unit — the shared publisher adapter pins the module's own aggregate type, so
 * every business publisher port bound to it records the right aggregate.
 */
describe('SharedOutboxAdapter', () => {
  const event: OutboxEvent = {
    eventId: 'evt-1',
    occurredAt: new Date(),
    version: 1,
  };

  it('appends with the aggregate type supplied at binding time', async () => {
    const append = jest.fn<Promise<void>, [OutboxEvent, string, string]>();
    append.mockResolvedValue(undefined);
    const adapter = new SharedOutboxAdapter({ append }, 'PurchaseOrder');

    await adapter.send(event, 'order-1');

    expect(append).toHaveBeenCalledWith(event, 'PurchaseOrder', 'order-1');
  });
});
