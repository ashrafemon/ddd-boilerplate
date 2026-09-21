import { Test, TestingModule } from '@nestjs/testing';
import { SagaPort } from './ports/saga.port';
import { SagaService } from './saga.service';
import { SagaRepositoryPort } from './ports/saga-repository.port';
import { SagaCommandPort } from './ports/saga-command.port';
import { SagaDefinitionRegistry } from './definitions/saga-definition';
import { StartSagaUseCase } from './usecases/start-saga.usecase';
import { HandleSagaEventUseCase } from './usecases/handle-saga-event.usecase';
import { SuspendSagaUseCase } from './usecases/suspend-saga.usecase';
import { CompensateSagaUseCase } from './usecases/compensate-saga.usecase';
import { InMemorySagaRepository } from './__testing__/in-memory-saga.repository';
import { FakeSagaCommandPort } from './__testing__/fake-saga-command.port';
import { SagaDefinition, SagaStatus } from './saga.types';

const testSagaDefinition: SagaDefinition = {
  type: 'TestSaga',
  version: 1,
  start: { eventType: 'TestStarted', eventVersion: 1 },
  steps: [
    {
      name: 'step-a',
      commandType: 'CommandA',
      waitFor: ['EventACompleted', 'EventAFailed'],
    },
    {
      name: 'step-b',
      commandType: 'CommandB',
      waitFor: ['EventBCompleted', 'EventBFailed'],
    },
  ],
  compensation: [{ on: 'step-b', commandType: 'CompensateA' }],
};

describe('Saga Module — Integration', () => {
  let module: TestingModule;
  let sagaPort: SagaPort;
  let repository: InMemorySagaRepository;
  let commandPort: FakeSagaCommandPort;
  let registry: SagaDefinitionRegistry;

  beforeAll(async () => {
    repository = new InMemorySagaRepository();
    commandPort = new FakeSagaCommandPort();
    registry = new SagaDefinitionRegistry();
    registry.register(testSagaDefinition);

    module = await Test.createTestingModule({
      providers: [
        SagaService,
        { provide: SagaPort, useExisting: SagaService },
        { provide: SagaRepositoryPort, useValue: repository },
        { provide: SagaCommandPort, useValue: commandPort },
        { provide: SagaDefinitionRegistry, useValue: registry },
        StartSagaUseCase,
        HandleSagaEventUseCase,
        SuspendSagaUseCase,
        CompensateSagaUseCase,
      ],
    }).compile();

    sagaPort = module.get(SagaPort);
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(() => {
    repository.clear();
    commandPort.clear();
  });

  it('should start a saga and dispatch first command', async () => {
    const instance = await sagaPort.start({
      tenantId: 't1',
      organizationId: 'o1',
      sagaType: 'TestSaga',
      triggerEvent: {
        eventType: 'TestStarted',
        payload: { orderId: 'order-1' },
      },
    });

    expect(instance).toBeDefined();
    expect(instance.status).toBe(SagaStatus.WAITING);
    expect(instance.currentStep).toBe('step-a');
    expect(instance.sagaType).toBe('TestSaga');
    expect(instance.correlationId).toBeDefined();

    // Command should have been dispatched
    expect(commandPort.getDispatched()).toHaveLength(1);
    expect(commandPort.getDispatched()[0].commandType).toBe('CommandA');
  });

  it('should handle a completing event and advance to next step', async () => {
    const instance = await sagaPort.start({
      tenantId: 't1',
      organizationId: 'o1',
      sagaType: 'TestSaga',
      triggerEvent: {
        eventType: 'TestStarted',
        payload: { orderId: 'order-1' },
      },
    });

    // Handle the completing event for step-a
    await sagaPort.handleEvent({
      tenantId: 't1',
      organizationId: 'o1',
      sagaType: 'TestSaga',
      correlationId: instance.correlationId,
      event: {
        eventType: 'EventACompleted',
        payload: { result: 'ok' },
      },
    });

    // Should have advanced to step-b
    const updated = await repository.findInstanceById(instance.id);
    expect(updated?.currentStep).toBe('step-b');
    expect(updated?.status).toBe(SagaStatus.WAITING);

    // Command B should have been dispatched
    const dispatched = commandPort.getDispatched();
    expect(dispatched).toHaveLength(2);
    expect(dispatched[1].commandType).toBe('CommandB');
  });

  it('should complete saga when last step finishes', async () => {
    const instance = await sagaPort.start({
      tenantId: 't1',
      organizationId: 'o1',
      sagaType: 'TestSaga',
      triggerEvent: {
        eventType: 'TestStarted',
        payload: { orderId: 'order-1' },
      },
    });

    // Complete step-a
    await sagaPort.handleEvent({
      tenantId: 't1',
      organizationId: 'o1',
      sagaType: 'TestSaga',
      correlationId: instance.correlationId,
      event: { eventType: 'EventACompleted', payload: {} },
    });

    // Complete step-b (last step)
    await sagaPort.handleEvent({
      tenantId: 't1',
      organizationId: 'o1',
      sagaType: 'TestSaga',
      correlationId: instance.correlationId,
      event: { eventType: 'EventBCompleted', payload: {} },
    });

    const updated = await repository.findInstanceById(instance.id);
    expect(updated?.status).toBe(SagaStatus.COMPLETED);
    expect(updated?.completedAt).toBeDefined();
  });

  it('should ignore events for non-existent saga', async () => {
    await sagaPort.handleEvent({
      tenantId: 't1',
      organizationId: 'o1',
      sagaType: 'TestSaga',
      correlationId: 'non-existent',
      event: { eventType: 'EventACompleted', payload: {} },
    });

    // Should not throw
    expect(true).toBe(true);
  });

  it('should suspend a saga', async () => {
    const instance = await sagaPort.start({
      tenantId: 't1',
      organizationId: 'o1',
      sagaType: 'TestSaga',
      triggerEvent: {
        eventType: 'TestStarted',
        payload: { orderId: 'order-1' },
      },
    });

    await sagaPort.suspend({
      tenantId: 't1',
      organizationId: 'o1',
      sagaInstanceId: instance.id,
      claimToken: instance.claimToken!,
      reason: 'Manual suspension',
    });

    const updated = await repository.findInstanceById(instance.id);
    expect(updated?.status).toBe(SagaStatus.SUSPENDED);
  });

  it('should not start saga when company config disables it', async () => {
    repository.addCompanyConfig({
      id: 'cfg-1',
      tenantId: 't1',
      organizationId: 'o1',
      sagaType: 'TestSaga',
      sagaVersion: 1,
      enabled: false,
      configJson: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const instance = await sagaPort.start({
      tenantId: 't1',
      organizationId: 'o1',
      sagaType: 'TestSaga',
      triggerEvent: {
        eventType: 'TestStarted',
        payload: { orderId: 'order-1' },
      },
    });

    // Should return stub instance with STARTED status
    expect(instance.status).toBe(SagaStatus.STARTED);
    expect(commandPort.getDispatched()).toHaveLength(0);
  });

  it('should ignore events when subscription is disabled', async () => {
    repository.addEventSubscription({
      id: 'sub-1',
      tenantId: 't1',
      organizationId: 'o1',
      sagaType: 'TestSaga',
      eventType: 'EventACompleted',
      eventVersion: 1,
      enabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const instance = await sagaPort.start({
      tenantId: 't1',
      organizationId: 'o1',
      sagaType: 'TestSaga',
      triggerEvent: {
        eventType: 'TestStarted',
        payload: { orderId: 'order-1' },
      },
    });

    // Handle event — should be ignored because subscription disabled
    await sagaPort.handleEvent({
      tenantId: 't1',
      organizationId: 'o1',
      sagaType: 'TestSaga',
      correlationId: instance.correlationId,
      event: { eventType: 'EventACompleted', payload: {} },
    });

    // Step should still be step-a (not advanced)
    const updated = await repository.findInstanceById(instance.id);
    expect(updated?.currentStep).toBe('step-a');
  });

  it('should start saga when no company config exists (default enabled)', async () => {
    const instance = await sagaPort.start({
      tenantId: 't1',
      organizationId: 'o1',
      sagaType: 'TestSaga',
      triggerEvent: {
        eventType: 'TestStarted',
        payload: { orderId: 'order-1' },
      },
    });

    expect(instance.status).toBe(SagaStatus.WAITING);
    expect(commandPort.getDispatched()).toHaveLength(1);
  });

  it('should compensate on failure when compensation is configured', async () => {
    const instance = await sagaPort.start({
      tenantId: 't1',
      organizationId: 'o1',
      sagaType: 'TestSaga',
      triggerEvent: {
        eventType: 'TestStarted',
        payload: { orderId: 'order-1' },
      },
    });

    // Complete step-a
    await sagaPort.handleEvent({
      tenantId: 't1',
      organizationId: 'o1',
      sagaType: 'TestSaga',
      correlationId: instance.correlationId,
      event: { eventType: 'EventACompleted', payload: {} },
    });

    // Fail step-b
    await sagaPort.handleEvent({
      tenantId: 't1',
      organizationId: 'o1',
      sagaType: 'TestSaga',
      correlationId: instance.correlationId,
      event: { eventType: 'EventBFailed', payload: { error: 'timeout' } },
    });

    const updated = await repository.findInstanceById(instance.id);
    expect(updated?.status).toBe(SagaStatus.COMPENSATING);
  });

  it('should handle tenant isolation', async () => {
    const instance1 = await sagaPort.start({
      tenantId: 't1',
      organizationId: 'o1',
      sagaType: 'TestSaga',
      triggerEvent: { eventType: 'TestStarted', payload: {} },
    });

    const instance2 = await sagaPort.start({
      tenantId: 't2',
      organizationId: 'o2',
      sagaType: 'TestSaga',
      triggerEvent: { eventType: 'TestStarted', payload: {} },
    });

    // Events from t1 should not affect t2
    await sagaPort.handleEvent({
      tenantId: 't1',
      organizationId: 'o1',
      sagaType: 'TestSaga',
      correlationId: instance1.correlationId,
      event: { eventType: 'EventACompleted', payload: {} },
    });

    const updated2 = await repository.findInstanceById(instance2.id);
    expect(updated2?.currentStep).toBe('step-a');
  });
});
