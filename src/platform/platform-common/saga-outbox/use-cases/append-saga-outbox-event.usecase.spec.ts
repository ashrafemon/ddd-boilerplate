import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { RequestContext } from '@platform/platform-common/context/ports/request-context';
import {
  DEFAULT_BROKER_TARGET,
  OutboxEventBase,
} from '@platform/platform-common/outbox/types/outbox.types';
import { SagaOutboxRepositoryPort } from '../outbound/ports/saga-outbox.repository.port';
import { AppendSagaOutboxEventUseCase } from './append-saga-outbox-event.usecase';

/**
 * Unit — appending to the saga's own ledger.
 *
 * The saga ledger keeps the same envelope contract as the shared outbox
 * (message-id headers, CLS tenancy, payload without envelope fields) while
 * writing to its own table, so a saga event can never be published by the
 * business dispatcher.
 */
describe('AppendSagaOutboxEventUseCase', () => {
  class SagaCompletedEvent extends OutboxEventBase {
    public readonly sagaKey = 'grn-to-invoice';
  }

  const CONTEXT = RequestContext.create({
    requestId: 'req-1',
    correlationId: 'corr-1',
    tenantId: 'tenant-1',
    companyId: 'company-1',
    userId: 'user-1',
    roles: [],
    locale: 'en',
  });

  function makeSut(context: RequestContext | null = CONTEXT) {
    const repository = { append: jest.fn(async (..._args: unknown[]) => undefined) };
    const requestContext = { get: jest.fn(() => context) };
    const useCase = new AppendSagaOutboxEventUseCase(
      repository as unknown as SagaOutboxRepositoryPort,
      requestContext as unknown as RequestContextPort,
    );
    return { useCase, repository };
  }

  it('appends to the saga ledger with CLS tenancy and message headers', async () => {
    const { useCase, repository } = makeSut();
    const event = new SagaCompletedEvent();

    await useCase.execute(event, 'SagaInstance', 'instance-1');

    expect(repository.append).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        companyId: 'company-1',
        eventId: event.eventId,
        eventType: 'SagaCompletedEvent',
        aggregateType: 'SagaInstance',
        aggregateId: 'instance-1',
        correlationId: 'corr-1',
        broker: DEFAULT_BROKER_TARGET,
      }),
    );

    const record = repository.append.mock.calls[0][0] as {
      headers: Record<string, string>;
    };
    expect(record.headers).toMatchObject({
      'message-id': event.eventId,
      'correlation-id': 'corr-1',
      'tenant-id': 'tenant-1',
      'company-id': 'company-1',
    });
  });

  it('keeps only the event payload, not the envelope fields', async () => {
    const { useCase, repository } = makeSut();

    await useCase.execute(new SagaCompletedEvent(), 'SagaInstance', 'instance-1');

    const payload = (repository.append.mock.calls[0][0] as { payload: Record<string, unknown> })
      .payload;
    expect(payload.sagaKey).toBe('grn-to-invoice');
    expect(typeof payload.occurredAt).toBe('string');
    expect(payload).not.toHaveProperty('eventId');
    expect(payload).not.toHaveProperty('headers');
  });

  it('falls back to the event correlation id outside a request', async () => {
    const { useCase, repository } = makeSut(null);
    const event = new SagaCompletedEvent({ correlationId: 'corr-event' });

    await useCase.execute(event, 'SagaInstance', 'instance-1');

    expect(repository.append).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: undefined,
        companyId: undefined,
        correlationId: 'corr-event',
      }),
    );
  });
});
