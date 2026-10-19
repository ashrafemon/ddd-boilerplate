import { EventEmitter2 } from '@nestjs/event-emitter';
import { OutboxEnvelope } from '@platform/outbox/outbox.types';
import { NestEventBusAdapter } from './adapters/nest-event-bus.adapter';
import { EmitEventUseCase } from './usecases/emit-event.usecase';
import { EventBusService } from './services/event-bus.service';

function makeEnvelope(overrides: Partial<OutboxEnvelope> = {}): OutboxEnvelope {
  return {
    eventId: 'evt-1',
    eventType: 'ProductCreated',
    aggregateType: 'Product',
    aggregateId: 'product-1',
    payload: { productId: 'product-1' },
    occurredAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('InProcessEventBus', () => {
  let emitter: { emit: jest.Mock };
  let service: EventBusService;

  beforeEach(() => {
    emitter = { emit: jest.fn() };
    const adapter = new NestEventBusAdapter(emitter as unknown as EventEmitter2);
    service = new EventBusService(new EmitEventUseCase(adapter));
  });

  it('emits on the event type with the canonical envelope', () => {
    const envelope = makeEnvelope();

    service.emit(envelope);

    expect(emitter.emit).toHaveBeenCalledTimes(1);
    expect(emitter.emit).toHaveBeenCalledWith('ProductCreated', envelope);
  });

  it('preserves the stable envelope identity (no rehydration)', () => {
    const envelope = makeEnvelope({ eventId: 'stable-id', correlationId: 'corr-1' });

    service.emit(envelope);

    const [, delivered] = emitter.emit.mock.calls[0] as [string, OutboxEnvelope];
    expect(delivered.eventId).toBe('stable-id');
    expect(delivered.correlationId).toBe('corr-1');
    expect(delivered.payload).toEqual({ productId: 'product-1' });
  });

  it('never propagates a throwing listener', () => {
    emitter.emit.mockImplementation(() => {
      throw new Error('listener blew up');
    });

    expect(() => service.emit(makeEnvelope())).not.toThrow();
  });
});
