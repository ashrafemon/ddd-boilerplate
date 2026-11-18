import { InboxAdapter } from './inbox.adapter';
import { ReceiveInboxMessageUseCase } from '../../use-cases/receive-inbox-message.usecase';
import { CompleteInboxMessageUseCase } from '../../use-cases/complete-inbox-message.usecase';
import { FailInboxMessageUseCase } from '../../use-cases/fail-inbox-message.usecase';
import { InboxReceiveRequest } from '../../types/inbox.types';

/** Unit — the inbound adapter maps one operation to one use case. */
describe('InboxAdapter', () => {
  const request: InboxReceiveRequest = {
    consumer: 'goods_receipt',
    messageId: 'evt-1',
    messageType: 'inventory.grn.created',
    payload: {},
  };

  it('routes receive, complete and fail to their use cases', async () => {
    const receive = jest.fn().mockResolvedValue({ status: 'DUPLICATE' });
    const complete = jest.fn().mockResolvedValue(undefined);
    const fail = jest.fn().mockResolvedValue(undefined);
    const adapter = new InboxAdapter(
      { execute: receive } as unknown as ReceiveInboxMessageUseCase,
      { execute: complete } as unknown as CompleteInboxMessageUseCase,
      { execute: fail } as unknown as FailInboxMessageUseCase,
    );

    await expect(adapter.receive(request)).resolves.toEqual({ status: 'DUPLICATE' });
    await adapter.complete({ reservation: { id: 'row-1', claimToken: 'claim-1' } });
    await adapter.fail({ reservation: { id: 'row-1', claimToken: 'claim-1' }, lastError: 'x' });

    expect(receive).toHaveBeenCalledWith(request);
    expect(complete).toHaveBeenCalledWith({
      reservation: { id: 'row-1', claimToken: 'claim-1' },
    });
    expect(fail).toHaveBeenCalledWith({
      reservation: { id: 'row-1', claimToken: 'claim-1' },
      lastError: 'x',
    });
  });
});
