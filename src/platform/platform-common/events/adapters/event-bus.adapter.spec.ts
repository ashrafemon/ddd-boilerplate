import { EventBusAdapter } from './event-bus.adapter';
import { EmitEventUseCase } from '../use-cases/emit-event.usecase';
import { MessageEnvelope } from '../ports/in-process-event-bus.port';

/** Unit — the inbound adapter only forwards to the use case. */
describe('EventBusAdapter', () => {
  const envelope: MessageEnvelope = {
    eventId: 'evt-1',
    eventType: 'OrderCreated',
    aggregateType: 'PurchaseOrder',
    aggregateId: 'order-1',
    payload: {},
    occurredAt: new Date(),
  };

  it('delegates emit to the use case', () => {
    const execute = jest.fn<void, [MessageEnvelope]>();
    const adapter = new EventBusAdapter({ execute } as unknown as EmitEventUseCase);

    adapter.emit(envelope);

    expect(execute).toHaveBeenCalledWith(envelope);
  });
});
