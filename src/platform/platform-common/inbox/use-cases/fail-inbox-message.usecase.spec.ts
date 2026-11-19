import { ConfigService } from '@config/config.service';
import { FailInboxMessageUseCase } from './fail-inbox-message.usecase';
import { PrismaInboxRepository } from '../repositories/prisma-inbox.repository';

/**
 * Unit — the two failure modes.
 *
 * A retryable failure schedules a backoff and leaves the row claimable; a
 * permanent one parks it FAILED so redeliveries stop looking like poison.
 */
describe('FailInboxMessageUseCase', () => {
  const CONFIG = {
    claimLeaseMs: 60_000,
    maxAttempts: 5,
    retryBaseDelayMs: 1_000,
    retryMaxDelayMs: 600_000,
    reconciliationIntervalMs: 60_000,
    processedRetentionMs: 1_000,
  };

  function makeSut() {
    const fail = jest.fn<Promise<boolean>, [string, string, string | null, number, number]>();
    fail.mockResolvedValue(true);
    const markPermanentlyFailed = jest.fn<Promise<boolean>, [string, string, string | null]>();
    markPermanentlyFailed.mockResolvedValue(true);
    const repository = { fail, markPermanentlyFailed } as unknown as PrismaInboxRepository;
    const config = { getInbox: () => CONFIG } as unknown as ConfigService;
    return {
      useCase: new FailInboxMessageUseCase(repository, config),
      fail,
      markPermanentlyFailed,
    };
  }

  it('schedules an exponential backoff with the configured bounds', async () => {
    const { useCase, fail } = makeSut();

    await useCase.execute({
      reservation: { id: 'row-1', claimToken: 'claim-1' },
      lastError: 'downstream 500',
    });

    expect(fail).toHaveBeenCalledWith('row-1', 'claim-1', 'downstream 500', 1_000, 600_000);
  });

  it('parks a permanent failure as FAILED without scheduling a retry', async () => {
    const { useCase, fail, markPermanentlyFailed } = makeSut();

    await useCase.execute({
      reservation: { id: 'row-1', claimToken: 'claim-1' },
      lastError: 'contract mismatch',
      permanent: true,
    });

    expect(markPermanentlyFailed).toHaveBeenCalledWith('row-1', 'claim-1', 'contract mismatch');
    expect(fail).not.toHaveBeenCalled();
  });
});
