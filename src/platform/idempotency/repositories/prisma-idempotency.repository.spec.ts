import { Prisma } from '../../../generated/client';
import { PrismaIdempotencyRepository } from './prisma-idempotency.repository';

type FakeTx = {
  create: jest.Mock;
  findUnique: jest.Mock;
  updateMany: jest.Mock;
  deleteMany: jest.Mock;
  $queryRaw: jest.Mock;
};

const freshTx = (overrides: Partial<FakeTx> = {}): FakeTx => ({
  create: jest.fn().mockResolvedValue({}),
  findUnique: jest.fn().mockResolvedValue(null),
  updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
  $queryRaw: jest.fn().mockResolvedValue([]),
  ...overrides,
});

const repoFor = (tx: FakeTx) =>
  new PrismaIdempotencyRepository({ tx: { idempotencyKey: tx, $queryRaw: tx.$queryRaw } } as never);

describe('PrismaIdempotencyRepository', () => {
  const ref = { scope: 'ctrl.method', key: 'k-1', tenantId: 't-1' };

  it('first insert acquires the reservation', async () => {
    const tx = freshTx();
    const repository = repoFor(tx);

    await expect(repository.reserve(ref)).resolves.toEqual({ status: 'ACQUIRED' });
    const createArg = (tx.create.mock.calls[0] as [{ data: Record<string, unknown> }])[0];
    expect(createArg.data).toMatchObject({
      scope: 'ctrl.method',
      key: 'k-1',
      tenantId: 't-1',
      status: 'IN_PROGRESS',
    });
  });

  it('conflict + completed row replays the stored result', async () => {
    const conflict = new Prisma.PrismaClientKnownRequestError('dup', {
      code: 'P2002',
      clientVersion: '7.9.1',
    });
    const tx = freshTx({
      create: jest.fn().mockRejectedValue(conflict),
      findUnique: jest
        .fn()
        .mockResolvedValue({ status: 'COMPLETED', result: { result: { id: 'job-9' } } }),
    });
    const repository = repoFor(tx);

    await expect(repository.reserve(ref)).resolves.toEqual({
      status: 'REPLAY',
      result: { id: 'job-9' },
    });
  });

  it('conflict + takeover of a FAILED/expired row re-acquires atomically', async () => {
    const conflict = new Prisma.PrismaClientKnownRequestError('dup', {
      code: 'P2002',
      clientVersion: '7.9.1',
    });
    const tx = freshTx({
      create: jest.fn().mockRejectedValue(conflict),
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'row' }]),
    });
    const repository = repoFor(tx);

    await expect(
      repository.reserve({ scope: 's', key: 'k', tenantId: undefined }),
    ).resolves.toEqual({
      status: 'ACQUIRED',
    });
  });

  it('in-flight fresh row blocks the caller', async () => {
    const conflict = new Prisma.PrismaClientKnownRequestError('dup', {
      code: 'P2002',
      clientVersion: '7.9.1',
    });
    const tx = freshTx({
      create: jest.fn().mockRejectedValue(conflict),
      findUnique: jest.fn().mockResolvedValue({ status: 'IN_PROGRESS', result: null }),
    });
    const repository = repoFor(tx);

    await expect(repository.reserve(ref)).resolves.toEqual({ status: 'IN_PROGRESS' });
  });

  it('markCompleted only flips IN_PROGRESS rows and stores an envelope', async () => {
    const tx = freshTx();
    const repository = repoFor(tx);

    await repository.markCompleted(ref, { ok: true });
    const settleArg = (
      tx.updateMany.mock.calls[0] as [
        { where: Record<string, unknown>; data: Record<string, unknown> },
      ]
    )[0];
    expect(settleArg.where).toMatchObject({ status: 'IN_PROGRESS', tenantId: 't-1' });
    expect(settleArg.data).toMatchObject({
      status: 'COMPLETED',
      result: { result: { ok: true } },
    });
  });
});
