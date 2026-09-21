import { randomUUID } from 'crypto';
import { DomainEventEnvelope } from './event-bus.types';
import { DomainEventRegistry } from './registries/domain-event.registry';
import { DomainEventDispatcher } from './dispatchers/domain-event.dispatcher';
import { PublishEventUseCase } from './usecases/publish-event.usecase';
import { RegisterEventHandlerUseCase } from './usecases/register-event-handler.usecase';
import { UnregisterEventHandlerUseCase } from './usecases/unregister-event-handler.usecase';
import { EventBusService } from './event-bus.service';

function makeEvent(overrides: Partial<DomainEventEnvelope> = {}): DomainEventEnvelope {
  return {
    eventId: randomUUID(),
    eventType: 'OrderCreated',
    eventVersion: 1,
    aggregateType: 'Order',
    aggregateId: randomUUID(),
    payload: { orderId: 'order-1' },
    occurredAt: new Date(),
    correlationId: randomUUID(),
    ...overrides,
  };
}

function makeHandler(id?: string): { handle: jest.Mock; id: string } {
  const handlerId = id ?? randomUUID();
  return { handle: jest.fn().mockResolvedValue(undefined), id: handlerId };
}

describe('EventBusService', () => {
  let registry: DomainEventRegistry;
  let dispatcher: DomainEventDispatcher;
  let publishUseCase: PublishEventUseCase;
  let registerUseCase: RegisterEventHandlerUseCase;
  let unregisterUseCase: UnregisterEventHandlerUseCase;
  let service: EventBusService;

  beforeEach(() => {
    registry = new DomainEventRegistry();
    dispatcher = new DomainEventDispatcher(registry);
    publishUseCase = new PublishEventUseCase(dispatcher);
    registerUseCase = new RegisterEventHandlerUseCase(registry);
    unregisterUseCase = new UnregisterEventHandlerUseCase(registry);
    service = new EventBusService(publishUseCase, registerUseCase, unregisterUseCase);
  });

  it('publishes to registered handlers', async () => {
    const handler = makeHandler();
    service.register({
      registrationId: handler.id,
      eventType: 'OrderCreated',
      eventVersion: 1,
      handler,
    });

    const event = makeEvent();
    const result = await service.publish(event);

    expect(result.dispatchedHandlers).toBe(1);
    expect(result.eventId).toBe(event.eventId);
    expect(handler.handle).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'OrderCreated' }),
    );
  });

  it('returns 0 dispatched handlers when no handlers registered', async () => {
    const event = makeEvent();
    const result = await service.publish(event);
    expect(result.dispatchedHandlers).toBe(0);
  });

  it('unregisters a handler', async () => {
    const handler = makeHandler('handler-1');
    service.register({
      registrationId: 'handler-1',
      eventType: 'OrderCreated',
      eventVersion: 1,
      handler,
    });

    service.unregister('handler-1');
    const result = await service.publish(makeEvent());
    expect(result.dispatchedHandlers).toBe(0);
  });

  it('does not fail when unregistering non-existent handler', () => {
    expect(() => service.unregister('non-existent')).not.toThrow();
  });

  it('does not register duplicate registration IDs', async () => {
    const handler = makeHandler();
    service.register({
      registrationId: handler.id,
      eventType: 'OrderCreated',
      eventVersion: 1,
      handler,
    });
    service.register({
      registrationId: handler.id,
      eventType: 'OrderCreated',
      eventVersion: 1,
      handler,
    });

    const result = await service.publish(makeEvent());
    expect(result.dispatchedHandlers).toBe(1);
  });

  it('dispatches to multiple handlers for the same event', async () => {
    const handler1 = makeHandler('h1');
    const handler2 = makeHandler('h2');

    service.register({
      registrationId: 'h1',
      eventType: 'OrderCreated',
      eventVersion: 1,
      handler: handler1,
    });
    service.register({
      registrationId: 'h2',
      eventType: 'OrderCreated',
      eventVersion: 1,
      handler: handler2,
    });

    const result = await service.publish(makeEvent());
    expect(result.dispatchedHandlers).toBe(2);
    expect(handler1.handle).toHaveBeenCalled();
    expect(handler2.handle).toHaveBeenCalled();
  });

  it('handler failure does not block other handlers (failFast=false)', async () => {
    const failingHandler = makeHandler('fail');
    failingHandler.handle.mockRejectedValue(new Error('handler broke'));
    const goodHandler = makeHandler('good');

    service.register({
      registrationId: 'fail',
      eventType: 'OrderCreated',
      eventVersion: 1,
      handler: failingHandler,
    });
    service.register({
      registrationId: 'good',
      eventType: 'OrderCreated',
      eventVersion: 1,
      handler: goodHandler,
    });

    const result = await service.publish(makeEvent());
    expect(result.dispatchedHandlers).toBe(1);
    expect(goodHandler.handle).toHaveBeenCalled();
  });

  it('handler failure throws when failFast=true', async () => {
    const failingHandler = makeHandler('fail');
    failingHandler.handle.mockRejectedValue(new Error('handler broke'));

    service.register({
      registrationId: 'fail',
      eventType: 'OrderCreated',
      eventVersion: 1,
      handler: failingHandler,
    });

    await expect(
      service.publish(makeEvent(), { failFast: true }),
    ).rejects.toThrow('handler broke');
  });

  it('filters handlers by tenant scope', async () => {
    const scopedHandler = makeHandler('scoped');
    service.register({
      registrationId: 'scoped',
      eventType: 'OrderCreated',
      eventVersion: 1,
      handler: scopedHandler,
      tenantId: 'tenant-A',
    });

    // Event for tenant-B should not trigger scoped handler
    const event = makeEvent({ tenantId: 'tenant-B' });
    const result = await service.publish(event);
    expect(result.dispatchedHandlers).toBe(0);
    expect(scopedHandler.handle).not.toHaveBeenCalled();

    // Event for tenant-A should trigger scoped handler
    const scopedEvent = makeEvent({ tenantId: 'tenant-A' });
    const scopedResult = await service.publish(scopedEvent);
    expect(scopedResult.dispatchedHandlers).toBe(1);
  });

  it('version routing works correctly', async () => {
    const v1Handler = makeHandler('v1');
    const v2Handler = makeHandler('v2');

    service.register({
      registrationId: 'v1',
      eventType: 'OrderCreated',
      eventVersion: 1,
      handler: v1Handler,
    });
    service.register({
      registrationId: 'v2',
      eventType: 'OrderCreated',
      eventVersion: 2,
      handler: v2Handler,
    });

    const v1Event = makeEvent({ eventVersion: 1 });
    await service.publish(v1Event);
    expect(v1Handler.handle).toHaveBeenCalled();
    expect(v2Handler.handle).not.toHaveBeenCalled();
  });

  it('preserves correlation and causation IDs', async () => {
    const handler = makeHandler();
    service.register({
      registrationId: handler.id,
      eventType: 'OrderCreated',
      eventVersion: 1,
      handler,
    });

    const event = makeEvent({
      correlationId: 'correlation-123',
      causationId: 'causation-456',
    });
    await service.publish(event);

    expect(handler.handle).toHaveBeenCalledWith(
      expect.objectContaining({
        correlationId: 'correlation-123',
        causationId: 'causation-456',
      }),
    );
  });
});
