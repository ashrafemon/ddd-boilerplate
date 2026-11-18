import { EmitEventUseCase } from './emit-event.usecase';
import { MessageEnvelope } from '../inbound/ports/in-process-event-bus.port';

/**
 * Unit — emit use case. The event type decides the listener channel, so it must
 * come from the envelope rather than a hardcoded name.
 */
const ENVELOPE: MessageEnvelope = {
  eventId: 'evt-1',
  eventType: 'OrderCreated',
  aggregateType: 'PurchaseOrder',
  aggregateId: 'order-1',
  payload: { orderId: 'order-1' },
  occurredAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('EmitEventUseCase', () => {
  it('emits on the envelope event type with the whole envelope', () => {
    const emit = jest.fn<void, [string, MessageEnvelope]>();
    const useCase = new EmitEventUseCase({ emit });

    useCase.execute(ENVELOPE);

    expect(emit).toHaveBeenCalledWith('OrderCreated', ENVELOPE);
  });
});
