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

const repoFor = (tx: FakeTx) =>
  new PrismaIdempotencyRepository({
    idempotencyKey: tx,
  } as never);

describe('PrismaIdempotencyRepository', () => {
  const identity = {
    tenantId: 't-1',
    organizationId: 'o-1',
    scope: 'ctrl.method',
    key: 'k-1',
  };

  it('insert creates a new row', async () => {
    const tx = freshTx();
    const repository = repoFor(tx);

    const result = await repository.insert(identity, 'claim-token', new Date(), 'hash-1');
    expect(tx.create).toHaveBeenCalled();
    expect(result.id).toBe('row-1');
    expect(result.version).toBe(1);
  });

  it('findUnique returns null when no row exists', async () => {
    const tx = freshTx({ findUnique: jest.fn().mockResolvedValue(null) });
    const repository = repoFor(tx);

    const result = await repository.findUnique(identity);
    expect(result).toBeNull();
  });

  it('findUnique returns row data when it exists', async () => {
    const tx = freshTx({
      findUnique: jest.fn().mockResolvedValue({
        id: 'row-1',
        status: 'COMPLETED',
        claimToken: 'token',
        version: 2,
        resultJson: { result: { id: 'order-1' } },
        requestHash: 'hash-1',
        claimedAt: new Date(),
        expiresAt: new Date(),
      }),
    });
    const repository = repoFor(tx);

    const result = await repository.findUnique(identity);
    expect(result?.status).toBe('COMPLETED');
    expect(result?.version).toBe(2);
  });

  it('complete updates COMPLETED status with CAS', async () => {
    const tx = freshTx({ updateMany: jest.fn().mockResolvedValue({ count: 1 }) });
    const repository = repoFor(tx);

    const success = await repository.complete('row-1', 'token', 1, { id: 'order-1' });
    expect(success).toBe(true);
    expect(tx.updateMany).toHaveBeenCalled();
  });

  it('complete returns false when ownership lost', async () => {
    const tx = freshTx({ updateMany: jest.fn().mockResolvedValue({ count: 0 }) });
    const repository = repoFor(tx);

    const success = await repository.complete('row-1', 'wrong-token', 1, { id: 'order-1' });
    expect(success).toBe(false);
  });

  it('fail updates FAILED status with CAS', async () => {
    const tx = freshTx({ updateMany: jest.fn().mockResolvedValue({ count: 1 }) });
    const repository = repoFor(tx);

    const success = await repository.fail('row-1', 'token', 1, 'ERR', 'message');
    expect(success).toBe(true);
  });

  it('purgeExpired deletes expired rows', async () => {
    const tx = freshTx({ deleteMany: jest.fn().mockResolvedValue({ count: 3 }) });
    const repository = repoFor(tx);

    const count = await repository.purgeExpired();
    expect(count).toBe(3);
  });
});
