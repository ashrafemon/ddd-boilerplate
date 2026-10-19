import { PrismaIdempotencyRepository } from './prisma-idempotency.repository';

type FakeTx = {
  create: jest.Mock;
  findUnique: jest.Mock;
  updateMany: jest.Mock;
  deleteMany: jest.Mock;
};

const freshTx = (overrides: Partial<FakeTx> = {}): FakeTx => ({
  create: jest.fn().mockResolvedValue({ id: 'row-1', version: 1 }),
  findUnique: jest.fn().mockResolvedValue(null),
  updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
  ...overrides,
});

const repoFor = (tx: FakeTx) => new PrismaIdempotencyRepository({ idempotencyKey: tx } as never);

describe('PrismaIdempotencyRepository', () => {
  const identity = { tenantId: 't1', companyId: 'o1', scope: 'test', key: 'k1' };
  const reservation = { ...identity, id: 'row-1', claimToken: 'tok', version: 1 };

  it('inserts a claim and returns id + version', async () => {
    const tx = freshTx();
    const repo = repoFor(tx);

    const result = await repo.insertClaim(identity, 'tok', new Date(), 'hash-1');

    expect(result).toEqual({ id: 'row-1', version: 1 });
    expect(tx.create).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          tenantId: 't1',
          companyId: 'o1',
          scope: 'test',
          key: 'k1',
          claimToken: 'tok',
          requestHash: 'hash-1',
        }),
      }),
    );
  });

  it('returns null when no row exists', async () => {
    const repo = repoFor(freshTx());
    await expect(repo.findByIdentity(identity)).resolves.toBeNull();
  });

  it('maps the row read model', async () => {
    const tx = freshTx({
      findUnique: jest.fn().mockResolvedValue({
        id: 'row-1',
        status: 'COMPLETED',
        claimToken: 'tok',
        version: 2,
        resultJson: { id: 'o-1' },
        requestHash: 'hash-1',
        claimedAt: new Date(),
        expiresAt: new Date(),
      }),
    });

    const row = await repoFor(tx).findByIdentity(identity);

    expect(row).toMatchObject({ id: 'row-1', status: 'COMPLETED', version: 2 });
  });

  it('returns null from takeover when no stale claim matched', async () => {
    const tx = freshTx({ updateMany: jest.fn().mockResolvedValue({ count: 0 }) });
    await expect(
      repoFor(tx).takeoverExpiredClaim(identity, 'new-token', new Date(), new Date()),
    ).resolves.toBeNull();
  });

  it('returns the new version after a successful takeover', async () => {
    const tx = freshTx({
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUnique: jest.fn().mockResolvedValue({ id: 'row-1', version: 4 }),
    });

    await expect(
      repoFor(tx).takeoverExpiredClaim(identity, 'new-token', new Date(), new Date()),
    ).resolves.toEqual({ id: 'row-1', version: 4 });
  });

  it('returns the row expiry on a successful complete CAS', async () => {
    const expiresAt = new Date(Date.now() + 60_000);
    const tx = freshTx({ findUnique: jest.fn().mockResolvedValue({ expiresAt }) });

    await expect(repoFor(tx).completeCas(reservation, { id: 'o-1' })).resolves.toEqual({
      expiresAt,
    });
  });

  it('returns null when the complete CAS loses ownership', async () => {
    const tx = freshTx({ updateMany: jest.fn().mockResolvedValue({ count: 0 }) });
    await expect(repoFor(tx).completeCas(reservation, { id: 'o-1' })).resolves.toBeNull();
  });

  it('deletes the row on fail CAS', async () => {
    const tx = freshTx({ deleteMany: jest.fn().mockResolvedValue({ count: 1 }) });
    await expect(repoFor(tx).failDeleteCas(reservation)).resolves.toBe(true);
  });

  it('purges expired rows', async () => {
    const tx = freshTx({ deleteMany: jest.fn().mockResolvedValue({ count: 3 }) });
    await expect(repoFor(tx).purgeExpired(new Date())).resolves.toBe(3);
  });
});
