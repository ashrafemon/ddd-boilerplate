import { ConfigService } from '@config/config.service';
import { PurgePublishedOutboxUseCase } from './purge-published-outbox.usecase';
import { PrismaOutboxRepository } from '../repositories/prisma-outbox.repository';

/**
 * Unit — retention sweep. Only PUBLISHED rows are deleted, and the window comes
 * from configuration rather than a literal.
 */
describe('PurgePublishedOutboxUseCase', () => {
  function makeSut(cleanupOlderThanHours: number) {
    const deletePublishedOlderThan = jest.fn<Promise<number>, [number]>();
    deletePublishedOlderThan.mockResolvedValue(3);
    const repository = {
      deletePublishedOlderThan,
    } as unknown as PrismaOutboxRepository;
    const config = { getOutbox: () => ({ cleanupOlderThanHours }) } as unknown as ConfigService;
    return {
      useCase: new PurgePublishedOutboxUseCase(repository, config),
      deletePublishedOlderThan,
    };
  }

  it('deletes with the configured retention window', async () => {
    const { useCase, deletePublishedOlderThan } = makeSut(48);

    await expect(useCase.execute()).resolves.toBe(3);
    expect(deletePublishedOlderThan).toHaveBeenCalledWith(48);
  });
});
