import { ConfigService } from '@config/config.service';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { OutboxEnvelope } from '@platform/platform-common/outbox/types/outbox.types';
import { instance } from '@test/support/saga/saga.fixtures';
import { AcceptSagaEventUseCase } from './accept-saga-event.usecase';
import { BuildSagaPlanUseCase } from './build-saga-plan.usecase';
import { BufferSagaEventUseCase } from './buffer-saga-event.usecase';
import { CancelSagaUseCase } from './cancel-saga.usecase';
import { StartSagaUseCase } from './start-saga.usecase';
import { SagaCompanyConfigRepositoryPort } from '../outbound/ports/saga-company-config.repository.port';
import { SagaDefinitionRepositoryPort } from '../outbound/ports/saga-definition.repository.port';
import { SagaInstanceRepositoryPort } from '../outbound/ports/saga-instance.repository.port';
import {
  SagaDefinitionBody,
  SagaDefinitionRecord,
  SagaDefinitionStatus,
  SagaInstanceRecord,
  SagaPlan,
} from '../types/saga.types';

/**
 * Unit — routing decides which saga an event belongs to.
 *
 * The loop guard, the tenant guard, the start filter and the correlation key are
 * all here: a saga that emits its own completion event must never re-enter, and
 * an event without tenant/company must never start one.
 */
describe('AcceptSagaEventUseCase', () => {
  const definition = (overrides: Partial<SagaDefinitionBody> = {}): SagaDefinitionBody => ({
    key: 'grn-to-invoice',
    version: 1,
    start: { event: { name: 'inventory.grn.created', version: 1 }, key: 'GRN:{{event.grnId}}' },
    steps: [{ id: 'valuate', policy: 'required', do: 'inventory.valuateReceipt' }],
    ...overrides,
  });

  function record(overrides: Partial<SagaDefinitionRecord> = {}): SagaDefinitionRecord {
    return {
      id: 'definition-1',
      ownerModule: 'procurement',
      sagaKey: 'grn-to-invoice',
      version: 1,
      eventName: 'inventory.grn.created',
      eventVersion: 1,
      status: SagaDefinitionStatus.ACTIVE,
      definition: definition(),
      createdAt: new Date('2024-01-01T00:00:00Z'),
      ...overrides,
    };
  }

  function envelope(overrides: Partial<OutboxEnvelope> = {}): OutboxEnvelope {
    return {
      eventId: 'evt-1',
      eventType: 'inventory.grn.created',
      eventVersion: 1,
      tenantId: 'tenant-1',
      companyId: 'company-1',
      aggregateType: 'GoodsReceipt',
      aggregateId: 'grn-1',
      payload: { grnId: 'grn-1' },
      occurredAt: new Date(),
      ...overrides,
    };
  }

  function makeSut() {
    const definitions = {
      findActiveByEvent: jest.fn(async (): Promise<SagaDefinitionRecord | null> => null),
      listActive: jest.fn(async (): Promise<SagaDefinitionRecord[]> => []),
    };
    const configs = { findActive: jest.fn(async () => null) };
    const instances = {
      findLiveByKey: jest.fn(async (): Promise<SagaInstanceRecord[]> => []),
      findWaitingByEvent: jest.fn(async (): Promise<SagaInstanceRecord[]> => []),
    };
    const planBuilder = {
      execute: jest.fn((): SagaPlan | null => ({
        sagaKey: 'k',
        version: 1,
        steps: [],
        cancelOn: [],
      })),
    };
    const startSaga = { execute: jest.fn(async () => instance()) };
    const cancelSaga = { execute: jest.fn(async () => undefined) };
    const bufferEvent = { execute: jest.fn(async () => true) };
    const featureGate = { enabled: jest.fn(async () => new Set<string>()) };
    const settings = { get: jest.fn(async () => ({})) };
    const requestContext = {
      run: jest.fn((_ctx: unknown, fn: () => Promise<void>) => fn()),
    };

    const useCase = new AcceptSagaEventUseCase(
      definitions as unknown as SagaDefinitionRepositoryPort,
      configs as unknown as SagaCompanyConfigRepositoryPort,
      instances as unknown as SagaInstanceRepositoryPort,
      planBuilder as unknown as BuildSagaPlanUseCase,
      startSaga as unknown as StartSagaUseCase,
      cancelSaga as unknown as CancelSagaUseCase,
      bufferEvent as unknown as BufferSagaEventUseCase,
      featureGate,
      settings,
      requestContext as unknown as RequestContextPort,
      { getSaga: () => ({ defaultMaxAttempts: 5 }) } as unknown as ConfigService,
    );
    return {
      useCase,
      definitions,
      configs,
      instances,
      planBuilder,
      startSaga,
      cancelSaga,
      bufferEvent,
      featureGate,
      requestContext,
    };
  }

  it("ignores the saga's own emitted events (loop guard)", async () => {
    const { useCase, definitions, startSaga } = makeSut();
    definitions.findActiveByEvent.mockResolvedValue(record());

    await useCase.execute(envelope({ aggregateType: 'Saga' }));

    expect(startSaga.execute).not.toHaveBeenCalled();
  });

  it('ignores an event without tenant or company', async () => {
    const { useCase, startSaga } = makeSut();

    await useCase.execute(envelope({ tenantId: undefined }));

    expect(startSaga.execute).not.toHaveBeenCalled();
  });

  it('starts a saga for the matching start event with the rendered key', async () => {
    const { useCase, definitions, startSaga } = makeSut();
    definitions.findActiveByEvent.mockResolvedValue(record());

    await useCase.execute(envelope());

    expect(startSaga.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        sagaKey: 'grn-to-invoice',
        definitionId: 'definition-1',
        correlationKey: 'GRN:grn-1',
      }),
    );
  });

  it('does not start when the start filter rejects the event', async () => {
    const { useCase, definitions, startSaga } = makeSut();
    definitions.findActiveByEvent.mockResolvedValue({
      id: 'definition-1',
      sagaKey: 'grn-to-invoice',
      definition: definition({
        start: {
          event: { name: 'inventory.grn.created', version: 1 },
          key: 'K:{{event.grnId}}',
          when: 'event.qty > 10',
        },
      }),
      status: SagaDefinitionStatus.ACTIVE,
    } as never);

    await useCase.execute(envelope({ payload: { grnId: 'grn-1', qty: 1 } }));

    expect(startSaga.execute).not.toHaveBeenCalled();
  });

  it('does not start when the plan builder returns null (capability missing)', async () => {
    const { useCase, definitions, planBuilder, startSaga } = makeSut();
    definitions.findActiveByEvent.mockResolvedValue(record());
    planBuilder.execute.mockReturnValue(null);

    await useCase.execute(envelope());

    expect(startSaga.execute).not.toHaveBeenCalled();
  });

  it('cancels the live instance on a cancel event', async () => {
    const { useCase, definitions, instances, cancelSaga } = makeSut();
    definitions.listActive.mockResolvedValue([
      record({
        definition: definition({ cancelOn: [{ name: 'inventory.grn.cancelled', version: 1 }] }),
      }),
    ]);
    instances.findLiveByKey.mockResolvedValue([instance()]);

    await useCase.execute(
      envelope({ eventType: 'inventory.grn.cancelled', payload: { grnId: 'grn-1' } }),
    );

    expect(cancelSaga.execute).toHaveBeenCalledWith('instance-1', 'CANCELLED_BY_EVENT');
  });

  it('buffers a WAIT event for the instance its match expression resolves to', async () => {
    const { useCase, definitions, instances, bufferEvent } = makeSut();
    definitions.listActive.mockResolvedValue([
      record({
        definition: definition({
          steps: [
            {
              id: 'wait-bill',
              policy: 'standard',
              waitFor: { name: 'ap.bill.posted', version: 1 },
              match: 'GRN:{{event.grnId}}',
            },
          ],
        }),
      }),
    ]);
    instances.findLiveByKey.mockResolvedValue([instance()]);

    await useCase.execute(
      envelope({ eventType: 'ap.bill.posted', payload: { grnId: 'grn-1', billId: 'b-1' } }),
    );

    const calls = bufferEvent.execute.mock.calls as unknown as [{ instance: { id: string } }][];
    expect(calls[0][0].instance.id).toBe('instance-1');
  });
});
