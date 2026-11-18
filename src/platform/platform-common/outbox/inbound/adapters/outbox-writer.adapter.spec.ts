import { OutboxWriterAdapter } from './outbox-writer.adapter';
import { AppendOutboxEventUseCase } from '../../use-cases/append-outbox-event.usecase';
import { OutboxEvent } from '../../types/outbox.types';

/**
 * Unit — the inbound adapter is pure delegation; the use case owns the rules.
 * This spec pins that contract so business callers cannot grow behaviour here.
 */
describe('OutboxWriterAdapter', () => {
  const event: OutboxEvent = {
    eventId: 'evt-1',
    occurredAt: new Date(),
    version: 1,
  };

  it('forwards event, aggregate and options to the use case', async () => {
    const execute = jest.fn<Promise<void>, Parameters<AppendOutboxEventUseCase['execute']>>();
    execute.mockResolvedValue(undefined);
    const adapter = new OutboxWriterAdapter({
      execute,
    } as unknown as AppendOutboxEventUseCase);

    await adapter.append(event, 'PurchaseOrder', 'order-1', { broker: 'sqs' });

    expect(execute).toHaveBeenCalledWith(event, 'PurchaseOrder', 'order-1', { broker: 'sqs' });
  });
});
