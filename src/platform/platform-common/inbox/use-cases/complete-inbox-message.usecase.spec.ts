import { CompleteInboxMessageUseCase } from './complete-inbox-message.usecase';
import { InboxRepositoryPort } from '../outbound/ports/inbox.repository.port';

/**
 * Unit — completing a delivery is a CAS on the claim token: losing ownership is
 * a warning, never an exception, because the broker's ACK must still be safe.
 */
describe('CompleteInboxMessageUseCase', () => {
  function makeSut(result = true) {
    const complete = jest.fn<Promise<boolean>, [string, string]>();
    complete.mockResolvedValue(result);
    const useCase = new CompleteInboxMessageUseCase({
      complete,
    } as unknown as InboxRepositoryPort);
    return { useCase, complete };
  }

  it('completes with the reservation token', async () => {
    const { useCase, complete } = makeSut();

    await useCase.execute({ reservation: { id: 'row-1', claimToken: 'claim-1' } });

    expect(complete).toHaveBeenCalledWith('row-1', 'claim-1');
  });

  it('does not throw when the claim was already lost', async () => {
    const { useCase } = makeSut(false);

    await expect(
      useCase.execute({ reservation: { id: 'row-1', claimToken: 'claim-1' } }),
    ).resolves.toBeUndefined();
  });
});
