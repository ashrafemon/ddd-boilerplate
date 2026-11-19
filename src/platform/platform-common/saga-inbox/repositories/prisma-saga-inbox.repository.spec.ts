import { SagaInboxStatus } from '../types/saga-inbox.types';
import { PrismaSagaInboxRepository } from './prisma-saga-inbox.repository';

/**
 * Unit — the SQL shape of the ledger writes.
 *
 * The repository is thin on purpose; what matters is that every state write is
 * conditional on the state it expects, so a concurrent worker cannot double-apply
 * a transition.
 */
describe('PrismaSagaInboxRepository', () => {
  type UpdateArgs = { where: Record<string, unknown>; data: Record<string, unknown> };

  function makeSut(count = 1) {
    const updateMany = jest.fn(async (_args: UpdateArgs) => ({ count }));
    const repo = new PrismaSagaInboxRepository({
      tx: { sagaInbox: { updateMany } },
    } as never);
    return { repo, updateMany };
  }

  it('marks consumed only from BUFFERED and reports whether it won', async () => {
    const { repo, updateMany } = makeSut(1);

    await expect(repo.markConsumed('inbox-1')).resolves.toBe(true);
    const [{ where, data }] = updateMany.mock.calls[0];
    expect(where).toEqual({ id: 'inbox-1', status: SagaInboxStatus.BUFFERED });
    expect(data).toMatchObject({ status: SagaInboxStatus.CONSUMED });
    expect(data.processedAt).toBeInstanceOf(Date);
  });

  it('reports a lost race when the row is no longer BUFFERED', async () => {
    const { repo } = makeSut(0);

    await expect(repo.markConsumed('inbox-1')).resolves.toBe(false);
  });

  it('parks buffered events as IGNORED and returns how many', async () => {
    const { repo, updateMany } = makeSut(3);

    await expect(
      repo.ignoreBuffered('instance-1', 'quality.inspection.completed', 1, 'WAIT skipped'),
    ).resolves.toBe(3);
    const [{ where, data }] = updateMany.mock.calls[0];
    expect(where).toEqual({
      instanceId: 'instance-1',
      eventName: 'quality.inspection.completed',
      eventVersion: 1,
      status: SagaInboxStatus.BUFFERED,
    });
    expect(data).toMatchObject({ status: SagaInboxStatus.IGNORED, reason: 'WAIT skipped' });
    expect(data.processedAt).toBeInstanceOf(Date);
  });
});
