import { ConfigService } from '@config/config.service';
import { PrismaSagaInboxRepository } from '../repositories/prisma-saga-inbox.repository';
import { PurgeSagaInboxUseCase } from './purge-saga-inbox.usecase';

/**
 * Unit — retention.
 *
 * The window comes from config (`SAGA_INBOX_RETENTION_DAYS`) and is passed
 * through untouched: a hard-coded window here would silently break dedupe after
 * a broker outage longer than it.
 */
describe('PurgeSagaInboxUseCase', () => {
  function makeSut(retentionDays = 30, deleted = 3) {
    const inbox = { purgeOlderThan: jest.fn(async () => deleted) };
    const configService = {
      getSaga: () => ({ inboxRetentionDays: retentionDays }),
    } as unknown as ConfigService;
    const useCase = new PurgeSagaInboxUseCase(
      inbox as unknown as PrismaSagaInboxRepository,
      configService,
    );
    return { useCase, inbox };
  }

  it('deletes rows past the configured retention window', async () => {
    const { useCase, inbox } = makeSut(14, 7);

    await expect(useCase.execute()).resolves.toBe(7);

    expect(inbox.purgeOlderThan).toHaveBeenCalledWith(14);
  });
});
