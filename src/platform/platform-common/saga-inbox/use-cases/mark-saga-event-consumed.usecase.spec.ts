import { SagaInboxRepositoryPort } from '../outbound/ports/saga-inbox.repository.port';
import { MarkSagaEventConsumedUseCase } from './mark-saga-event-consumed.usecase';

/**
 * Unit — consumption is a compare-and-set, not a blind update.
 *
 * Two workers can hold the same buffered row (read-then-mark); exactly one must
 * win so the loser can tell its match was redundant instead of assuming it
 * consumed a fresh delivery.
 */
describe('MarkSagaEventConsumedUseCase', () => {
  function makeSut(claimed: boolean) {
    const inbox = { markConsumed: jest.fn(async () => claimed) };
    const useCase = new MarkSagaEventConsumedUseCase(inbox as unknown as SagaInboxRepositoryPort);
    return { useCase, inbox };
  }

  it('reports the win when the row was still BUFFERED', async () => {
    const { useCase, inbox } = makeSut(true);

    await expect(useCase.execute('inbox-1')).resolves.toBe(true);
    expect(inbox.markConsumed).toHaveBeenCalledWith('inbox-1');
  });

  it('reports the loss when another worker consumed it first', async () => {
    const { useCase } = makeSut(false);

    await expect(useCase.execute('inbox-1')).resolves.toBe(false);
  });
});
