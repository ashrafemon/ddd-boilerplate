import { InMemoryDistributedLockAdapter } from '../__testing__/in-memory-distributed-lock.adapter';
import { DistributedLockAcquireRequest } from '../locking.types';

describe('DistributedLockService (in-memory adapter)', () => {
  let adapter: InMemoryDistributedLockAdapter;

  beforeEach(() => {
    adapter = new InMemoryDistributedLockAdapter();
  });

  const baseRequest: DistributedLockAcquireRequest = {
    tenantId: 'tenant-001',
    organizationId: 'org-001',
    scope: 'inventory.stock',
    resource: 'product-123',
    leaseMs: 5_000,
  };

  it('acquires a lock and returns ACQUIRED with ticket', async () => {
    const result = await adapter.acquire(baseRequest);

    expect(result.status).toBe('ACQUIRED');
    if (result.status === 'ACQUIRED') {
      expect(result.ticket.lockKey).toBe('tenant-001:org-001:inventory.stock:product-123');
      expect(result.ticket.fencingToken).toBe(1);
      expect(result.ticket.ownerToken).toBeDefined();
    }
  });

  it('returns BUSY when lock is already held', async () => {
    await adapter.acquire(baseRequest);
    const result = await adapter.acquire(baseRequest);

    expect(result.status).toBe('BUSY');
    if (result.status === 'BUSY') {
      expect(result.retryAfterMs).toBe(5_000);
    }
  });

  it('releases a held lock', async () => {
    const acq = await adapter.acquire(baseRequest);
    expect(acq.status).toBe('ACQUIRED');

    if (acq.status === 'ACQUIRED') {
      await adapter.release({ ticket: acq.ticket });
      expect(adapter.isHeld('tenant-001:org-001:inventory.stock:product-123')).toBe(false);
    }
  });

  it('allows re-acquisition after release', async () => {
    const acq1 = await adapter.acquire(baseRequest);
    if (acq1.status === 'ACQUIRED') {
      await adapter.release({ ticket: acq1.ticket });
    }

    const acq2 = await adapter.acquire(baseRequest);
    expect(acq2.status).toBe('ACQUIRED');
    if (acq2.status === 'ACQUIRED') {
      expect(acq2.ticket.fencingToken).toBe(2);
    }
  });

  it('renews a held lock', async () => {
    const acq = await adapter.acquire({ ...baseRequest, leaseMs: 5_000 });
    expect(acq.status).toBe('ACQUIRED');

    if (acq.status === 'ACQUIRED') {
      const renew = await adapter.renew({ ticket: acq.ticket, leaseMs: 10_000 });
      expect(renew.status).toBe('RENEWED');
    }
  });

  it('returns LOST on renew when lock is not held', async () => {
    const fakeTicket = {
      lockId: 'fake',
      lockKey: 'tenant-001:org-001:inventory.stock:product-123',
      ownerToken: 'wrong-owner',
      fencingToken: 1,
      acquiredAt: new Date(),
      expiresAt: new Date(),
    };

    const renew = await adapter.renew({ ticket: fakeTicket, leaseMs: 5_000 });
    expect(renew.status).toBe('LOST');
  });

  it('increments fencing token on each acquisition', async () => {
    const acq1 = await adapter.acquire(baseRequest);
    if (acq1.status === 'ACQUIRED') {
      await adapter.release({ ticket: acq1.ticket });
    }

    const acq2 = await adapter.acquire(baseRequest);
    if (acq2.status === 'ACQUIRED') {
      await adapter.release({ ticket: acq2.ticket });
    }

    const acq3 = await adapter.acquire(baseRequest);
    expect(acq3.status).toBe('ACQUIRED');
    if (acq3.status === 'ACQUIRED') {
      expect(acq3.ticket.fencingToken).toBe(3);
    }
  });
});
