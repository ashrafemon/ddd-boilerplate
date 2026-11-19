import { WireEnvelope } from '@platform/platform-common/messaging/adapters/envelope.serializer';
import { OutboxEnvelope } from '@platform/platform-common/outbox/types/outbox.types';
import { SagaBrokerConsumerService } from './saga-broker-consumer.service';

/**
 * Unit — the ONLY way events reach the saga.
 *
 * The saga owns no broker adapter of its own: it is bound to the topic exchange
 * with `#` and every delivery is mapped back to the canonical envelope before
 * `accept`. No in-process bus, no direct method call from a business use case.
 */
describe('SagaBrokerConsumerService', () => {
  it('subscribes to every routing key on module init', async () => {
    const { service, consumer } = makeSut();

    await service.onModuleInit();

    expect(consumer.subscribe).toHaveBeenCalledWith(
      { routingKey: '#', queue: 'saga.all-events.erp' },
      expect.any(Function),
    );
  });

  const wire: WireEnvelope = {
    eventId: 'evt-1',
    eventType: 'inventory.grn.created',
    eventVersion: 1,
    tenantId: 'tenant-1',
    companyId: 'company-1',
    aggregateType: 'GoodReceiptNote',
    aggregateId: 'grn-1',
    payload: { grnId: 'grn-1' },
    headers: {},
    occurredAt: '2026-01-01T00:00:00.000Z',
    correlationId: 'corr-1',
    causationId: null,
  };

  function makeSut() {
    const accept = jest.fn(async (_envelope: OutboxEnvelope) => undefined);
    const consumer = { subscribe: jest.fn(async () => undefined) };
    const service = new SagaBrokerConsumerService({ accept }, consumer);
    return { service, accept, consumer };
  }

  it('maps the wire body back to a canonical envelope and routes it', async () => {
    const { service, accept } = makeSut();

    await service.onDomainEvent(wire);

    expect(accept).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'evt-1',
        eventType: 'inventory.grn.created',
        eventVersion: 1,
        tenantId: 'tenant-1',
        companyId: 'company-1',
        aggregateType: 'GoodReceiptNote',
        aggregateId: 'grn-1',
        correlationId: 'corr-1',
      }),
    );
    const envelope = accept.mock.calls[0][0];
    expect(envelope.occurredAt).toBeInstanceOf(Date);
    expect(envelope.occurredAt.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('ignores a delivery that is not an envelope', async () => {
    const { service, accept } = makeSut();
    const warn = jest.spyOn(service['logger'], 'warn');

    await service.onDomainEvent({ hello: 'world' });
    await service.onDomainEvent('not an object');

    expect(accept).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });

  it('ignores an unscoped event instead of starting a tenant-less saga', async () => {
    const { service, accept } = makeSut();

    await service.onDomainEvent({ ...wire, tenantId: null });

    expect(accept).not.toHaveBeenCalled();
  });

  it('acks after a router failure instead of requeueing a poison message', async () => {
    const { service, accept } = makeSut();
    accept.mockRejectedValueOnce(new Error('db down'));
    const error = jest.spyOn(service['logger'], 'error');

    await expect(service.onDomainEvent(wire)).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(expect.stringContaining('db down'));
  });
});
