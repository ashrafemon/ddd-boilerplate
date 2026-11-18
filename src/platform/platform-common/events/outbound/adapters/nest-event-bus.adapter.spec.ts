import { EventEmitter2 } from '@nestjs/event-emitter';
import { NestEventBusAdapter } from './nest-event-bus.adapter';
import { MessageEnvelope } from '../../inbound/ports/in-process-event-bus.port';

/**
 * Unit — the EventEmitter2 adapter.
 *
 * Dispatch is keyed by the envelope's event type, and a throwing listener is
 * swallowed: the broker already owns the message, so a listener bug must not
 * push the outbox row into retry.
 */
const ENVELOPE: MessageEnvelope = {
  eventId: 'evt-1',
  eventType: 'OrderCreated',
  aggregateType: 'PurchaseOrder',
  aggregateId: 'order-1',
  payload: { orderId: 'order-1' },
  occurredAt: new Date('2026-01-01T00:00:00.000Z'),
};

function makeSut() {
  const emitter = new EventEmitter2();
  const emit = jest.spyOn(emitter, 'emit').mockReturnValue(true);
  const adapter = new NestEventBusAdapter(emitter);
  return { adapter, emit };
}

describe('NestEventBusAdapter', () => {
  it('emits on the envelope event type with the whole envelope', () => {
    const { adapter, emit } = makeSut();

    adapter.emit('OrderCreated', ENVELOPE);

    expect(emit).toHaveBeenCalledWith('OrderCreated', ENVELOPE);
  });

  it('swallows a throwing listener', () => {
    const { adapter, emit } = makeSut();
    emit.mockImplementation(() => {
      throw new Error('listener blew up');
    });

    expect(() => adapter.emit('OrderCreated', ENVELOPE)).not.toThrow();
  });
});
