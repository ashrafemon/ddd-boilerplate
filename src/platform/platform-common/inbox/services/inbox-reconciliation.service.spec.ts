import { ConfigService } from '@config/config.service';
import { InboxReconciliationService } from './inbox-reconciliation.service';
import { PrismaInboxRepository } from '../repositories/prisma-inbox.repository';

/**
 * Unit — the sweep uses configuration, not literals, and keeps the two actions
 * separate: reconcile (park poison + backoff the rest) and purge (processed
 * past retention). Suspended rows are never purged by this path.
 */
describe('InboxReconciliationService', () => {
  const CONFIG = {
    claimLeaseMs: 45_000,
    maxAttempts: 7,
    retryBaseDelayMs: 500,
    retryMaxDelayMs: 120_000,
    reconciliationIntervalMs: 60_000,
    processedRetentionMs: 2_592_000_000,
  };

  function makeSut() {
    const reconcileExpiredClaims = jest.fn<Promise<number>, [never]>();
    reconcileExpiredClaims.mockResolvedValue(2);
    const deleteProcessedOlderThan = jest.fn<Promise<number>, [number]>();
    deleteProcessedOlderThan.mockResolvedValue(3);
    const repository = {
      reconcileExpiredClaims,
      deleteProcessedOlderThan,
    } as unknown as PrismaInboxRepository;
    const config = { getInbox: () => CONFIG } as unknown as ConfigService;
    return {
      service: new InboxReconciliationService(repository, config),
      reconcileExpiredClaims,
      deleteProcessedOlderThan,
    };
  }

  it('reconciles with the configured lease and attempt ceiling', async () => {
    const { service, reconcileExpiredClaims } = makeSut();

    await service.reconcile();

    const options = reconcileExpiredClaims.mock.calls[0][0] as unknown as {
      now: Date;
      claimLeaseMs: number;
      maxAttempts: number;
      retryBaseDelayMs: number;
      retryMaxDelayMs: number;
    };
    expect(options.now).toBeInstanceOf(Date);
    expect(options).toMatchObject({
      claimLeaseMs: 45_000,
      maxAttempts: 7,
      retryBaseDelayMs: 500,
      retryMaxDelayMs: 120_000,
    });
  });

  it('purges processed rows with the configured retention', async () => {
    const { service, deleteProcessedOlderThan } = makeSut();

    await service.reconcile();

    expect(deleteProcessedOlderThan).toHaveBeenCalledWith(2_592_000_000);
  });
});
