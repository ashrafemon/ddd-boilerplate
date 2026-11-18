import { ConfigService } from '@config/config.service';
import { AcquireDistributedLockUseCase } from './acquire-distributed-lock.usecase';
import { DistributedLockAcquireRequest, LockLedgerClaim } from '../types/locking.types';

/**
 * Unit — the hybrid acquire path.
 *
 * The order is the contract: Redis decides who holds the lock now, the ledger
 * mints the fencing token, and a ledger refusal must hand the lease back so the
 * two halves cannot disagree. Also covers the non-durable escape hatch.
 */

const REQUEST: DistributedLockAcquireRequest = {
  tenantId: 'tenant-1',
  companyId: 'company-1',
  scope: 'numbering.invoice',
  resource: 'INV-2026',
};

const CONFIG = {
  defaultLeaseMs: 30_000,
  minLeaseMs: 5_000,
  maxLeaseMs: 300_000,
  renewIntervalMs: 10_000,
  durable: true,
};

type LedgerMock = {
  claim: jest.Mock<Promise<LockLedgerClaim | null>, [unknown, string, string, Date]>;
  renew: jest.Mock<Promise<LockLedgerClaim | null>, [unknown, string, Date]>;
  release: jest.Mock<Promise<void>, [unknown, string]>;
};

function makeSut(options: { durable?: boolean } = {}) {
  const acquired: { ownerToken: string; lockKey: string } = { ownerToken: '', lockKey: '' };
  const acquire = jest.fn<Promise<boolean>, [string, string, number]>();
  acquire.mockImplementation((lockKey: string, ownerToken: string) => {
    acquired.lockKey = lockKey;
    acquired.ownerToken = ownerToken;
    return Promise.resolve(true);
  });
  const renew = jest.fn<Promise<boolean>, [string, string, number]>();
  renew.mockResolvedValue(true);
  const release = jest.fn<Promise<boolean>, [string, string]>();
  release.mockResolvedValue(true);
  const nextFencingToken = jest.fn<Promise<number>, [string]>();
  nextFencingToken.mockResolvedValue(7);
  const isHeld = jest.fn<Promise<boolean>, [string]>();
  isHeld.mockResolvedValue(true);

  const claim = jest.fn<Promise<LockLedgerClaim | null>, [unknown, string, string, Date]>();
  claim.mockResolvedValue({ lockId: 'lock-1', fencingToken: 4 });

  const lease = { acquire, renew, release, nextFencingToken, isHeld };
  const ledger: LedgerMock = {
    claim,
    renew: jest.fn<Promise<LockLedgerClaim | null>, [unknown, string, Date]>(),
    release: jest.fn<Promise<void>, [unknown, string]>(),
  };

  const configService = {
    getLocking: () => ({ ...CONFIG, durable: options.durable ?? true }),
  } as unknown as ConfigService;

  const useCase = new AcquireDistributedLockUseCase(lease, ledger, configService);

  return { useCase, lease, ledger, acquired };
}

describe('AcquireDistributedLockUseCase', () => {
  it('answers BUSY when Redis already holds the lease', async () => {
    const { useCase, lease, ledger } = makeSut();
    lease.acquire.mockResolvedValue(false);

    const result = await useCase.execute(REQUEST);

    expect(result.status).toBe('BUSY');
    expect(ledger.claim).not.toHaveBeenCalled();
    expect(lease.release).not.toHaveBeenCalled();
  });

  it('takes the ledger claim and returns its fencing token', async () => {
    const { useCase, ledger, acquired } = makeSut();

    const result = await useCase.execute(REQUEST);

    expect(result.status).toBe('ACQUIRED');
    if (result.status !== 'ACQUIRED') return;

    expect(ledger.claim).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'numbering.invoice', resource: 'INV-2026' }),
      acquired.lockKey,
      acquired.ownerToken,
      expect.any(Date),
    );
    expect(acquired.lockKey).toContain('lock:tenant-1:company-1:numbering.invoice:INV-2026');
    expect(result.ticket.lockId).toBe('lock-1');
    expect(result.ticket.fencingToken).toBe(4);
    expect(result.ticket.identity.tenantId).toBe('tenant-1');
    expect(result.ticket.ownerToken).toBe(acquired.ownerToken);
  });

  it('hands the lease back when the ledger still has a live owner', async () => {
    const { useCase, lease, ledger, acquired } = makeSut();
    ledger.claim.mockResolvedValue(null);

    const result = await useCase.execute(REQUEST);

    expect(result.status).toBe('BUSY');
    expect(lease.release).toHaveBeenCalledWith(acquired.lockKey, acquired.ownerToken);
  });

  it('uses the Redis counter and skips the ledger when not durable', async () => {
    const { useCase, lease, ledger } = makeSut({ durable: false });

    const result = await useCase.execute(REQUEST);

    expect(result.status).toBe('ACQUIRED');
    if (result.status !== 'ACQUIRED') return;
    expect(result.ticket.fencingToken).toBe(7);
    expect(ledger.claim).not.toHaveBeenCalled();
    expect(lease.nextFencingToken).toHaveBeenCalledWith(expect.any(String));
  });

  it('releases the lease when the token counter is unavailable', async () => {
    const { useCase, lease } = makeSut({ durable: false });
    lease.nextFencingToken.mockRejectedValue(new Error('redis down'));

    const result = await useCase.execute(REQUEST);

    expect(result.status).toBe('BUSY');
    expect(lease.release).toHaveBeenCalled();
  });

  it('clamps the requested lease into the configured bounds', async () => {
    const { useCase, lease } = makeSut();

    await useCase.execute({ ...REQUEST, leaseMs: 1_000 });

    expect(lease.acquire).toHaveBeenCalledWith(expect.any(String), expect.any(String), 5_000);
  });
});
