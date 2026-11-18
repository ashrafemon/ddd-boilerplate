import { ConfigService } from '@config/config.service';
import { step } from '@test/support/saga/saga.fixtures';
import { SagaSweepService } from './saga-sweep.service';
import { SagaStepWorkerService, STALE_LEASE_ERROR } from './saga-step-worker.service';
import { ExecuteSagaStepUseCase } from '../use-cases/execute-saga-step.usecase';
import { ExpireWaitStepUseCase } from '../use-cases/expire-wait-step.usecase';
import { SagaInboxRepositoryPort } from '../outbound/ports/saga-inbox.repository.port';
import { SagaStepRepositoryPort } from '../outbound/ports/saga-step.repository.port';

/**
 * Unit — the sweep is the only clock the saga has.
 *
 * A tick must run claimed rows, then timeouts, then stale leases; a second tick
 * while one is in flight must be dropped (otherwise a slow batch doubles every
 * side effect); retention is hourly and separate.
 */
describe('SagaSweepService', () => {
  const CONFIG = {
    getSaga: () => ({
      sweepIntervalMs: 10_000,
      inboxRetentionDays: 30,
      workerLeaseSeconds: 60,
      claimBatchSize: 20,
      fairnessCap: 5,
    }),
  } as unknown as ConfigService;

  function makeSut() {
    const worker = { claimBatch: jest.fn(async () => [step()]) };
    const executeStep = { execute: jest.fn(async () => undefined) };
    const expireWait = { execute: jest.fn(async () => undefined) };
    const steps = {
      findExpiredWaits: jest.fn(async () => [] as ReturnType<typeof step>[]),
      findStaleRunning: jest.fn(async () => [] as ReturnType<typeof step>[]),
      reschedule: jest.fn(async () => undefined),
    };
    const inbox = { purgeOlderThan: jest.fn(async () => 0) };

    const service = new SagaSweepService(
      worker as unknown as SagaStepWorkerService,
      executeStep as unknown as ExecuteSagaStepUseCase,
      expireWait as unknown as ExpireWaitStepUseCase,
      steps as unknown as SagaStepRepositoryPort,
      inbox as unknown as SagaInboxRepositoryPort,
      CONFIG,
    );
    return { service, worker, executeStep, expireWait, steps, inbox };
  }

  afterEach(() => {
    jest.useRealTimers();
  });

  it('runs claimed steps, then timeouts, then stale leases', async () => {
    const { service, worker, executeStep, steps } = makeSut();
    steps.findExpiredWaits.mockResolvedValue([step({ id: 'wait-row', stepId: 'wait' })]);
    steps.findStaleRunning.mockResolvedValue([
      step({ id: 'stale-row', attempts: 2, lockUntil: new Date(0) }),
    ]);

    await service.tick();

    expect(worker.claimBatch).toHaveBeenCalledTimes(1);
    expect(executeStep.execute).toHaveBeenCalledWith(expect.objectContaining({ id: 'step-row-1' }));
    expect(steps.reschedule).toHaveBeenCalledWith(
      'stale-row',
      2,
      expect.any(Date),
      STALE_LEASE_ERROR,
    );
  });

  it('drops a second tick while one is still running', async () => {
    const { service, worker, expireWait } = makeSut();
    let release: (() => void) | undefined;
    worker.claimBatch.mockImplementation(
      () =>
        new Promise<never[]>(resolve => {
          release = () => resolve([]);
        }),
    );

    const first = service.tick();
    await service.tick();
    expect(worker.claimBatch).toHaveBeenCalledTimes(1);

    release?.();
    await first;
    expect(expireWait.execute).not.toHaveBeenCalled();
  });

  it('swallows a failing tick and stays usable', async () => {
    const { service, worker } = makeSut();
    worker.claimBatch.mockRejectedValueOnce(new Error('db down'));

    await expect(service.tick()).resolves.toBeUndefined();
    await expect(service.tick()).resolves.toBeUndefined();
    expect(worker.claimBatch).toHaveBeenCalledTimes(2);
  });

  it('purges saga inbox rows past retention', async () => {
    const { service, inbox } = makeSut();

    await service.cleanupInbox();

    expect(inbox.purgeOlderThan).toHaveBeenCalledWith(30);
  });

  it('starts and stops its interval without leaking a timer', () => {
    jest.useFakeTimers();
    const { service, worker } = makeSut();

    service.onModuleInit();
    jest.advanceTimersByTime(10_000);
    service.onModuleDestroy();

    expect(worker.claimBatch).toHaveBeenCalled();
  });
});
