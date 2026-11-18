import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { AppendOutboxEventUseCase } from './append-outbox-event.usecase';
import { OutboxRepositoryPort } from '../outbound/ports/outbox.repository.port';
import { AppendOutboxEventRequest, OutboxEvent, OutboxMessage } from '../types/outbox.types';

/**
 * Unit — appending to the outbox.
 *
 * The row must carry the caller's tenant/company from CLS (never a request
 * body), the envelope fields must be columns rather than payload, and the
 * payload must keep only the event's own data.
 */

class TestEvent implements OutboxEvent {
  readonly eventId = 'evt-1';
  readonly occurredAt = new Date('2026-01-01T00:00:00.000Z');
  readonly version = 2;
  readonly headers = { 'x-trace': 'trace-1' };

  constructor(readonly orderId: string) {}
}

function makeSut(context: { tenantId?: string; companyId?: string; correlationId?: string }) {
  const append = jest.fn<Promise<OutboxMessage>, [AppendOutboxEventRequest]>();
  append.mockResolvedValue({} as OutboxMessage);
  const repository = { append } as unknown as OutboxRepositoryPort;
  const requestContext = {
    get: () => context,
  } as unknown as RequestContextPort;

  return { useCase: new AppendOutboxEventUseCase(repository, requestContext), append };
}

describe('AppendOutboxEventUseCase', () => {
  it('stamps the tenant, company and correlation from CLS', async () => {
    const { useCase, append } = makeSut({
      tenantId: 'tenant-1',
      companyId: 'company-1',
      correlationId: 'corr-1',
    });

    await useCase.execute(new TestEvent('order-1'), 'PurchaseOrder', 'order-1');

    expect(append).toHaveBeenCalledTimes(1);
    expect(append.mock.calls[0][0]).toMatchObject({
      tenantId: 'tenant-1',
      companyId: 'company-1',
      correlationId: 'corr-1',
      eventId: 'evt-1',
      eventType: 'TestEvent',
      eventVersion: 2,
      aggregateType: 'PurchaseOrder',
      aggregateId: 'order-1',
      broker: 'rabbitmq',
    });
  });

  it('keeps envelope fields out of the payload', async () => {
    const { useCase, append } = makeSut({ tenantId: 't' });

    await useCase.execute(new TestEvent('order-1'), 'PurchaseOrder', 'order-1');

    const payload = append.mock.calls[0][0].payload;
    expect(payload).toEqual({
      orderId: 'order-1',
      occurredAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('mirrors identity and correlation into the message headers', async () => {
    const { useCase, append } = makeSut({
      tenantId: 'tenant-1',
      companyId: 'company-1',
      correlationId: 'corr-1',
    });

    await useCase.execute(new TestEvent('order-1'), 'PurchaseOrder', 'order-1');

    expect(append.mock.calls[0][0].headers).toMatchObject({
      'x-trace': 'trace-1',
      'message-id': 'evt-1',
      'event-id': 'evt-1',
      'correlation-id': 'corr-1',
      'tenant-id': 'tenant-1',
      'company-id': 'company-1',
      broker: 'rabbitmq',
    });
  });

  it('carries the aggregate version when the event knows it', async () => {
    const { useCase, append } = makeSut({ tenantId: 't' });

    await useCase.execute(
      Object.assign(new TestEvent('order-1'), { aggregateVersion: 5 }),
      'PurchaseOrder',
      'order-1',
    );

    expect(append.mock.calls[0][0].aggregateVersion).toBe(5);
  });

  it('honours an explicit broker target', async () => {
    const { useCase, append } = makeSut({});

    await useCase.execute(new TestEvent('order-1'), 'PurchaseOrder', 'order-1', {
      broker: 'kafka',
    });

    expect(append.mock.calls[0][0].broker).toBe('kafka');
    expect(append.mock.calls[0][0].headers?.['broker']).toBe('kafka');
  });
});
