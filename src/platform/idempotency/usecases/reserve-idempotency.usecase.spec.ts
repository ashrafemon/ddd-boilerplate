import { ReserveIdempotencyUseCase } from './reserve-idempotency.usecase';
import { InMemoryIdempotencyRepository } from '../__testing__/in-memory-idempotency.repository';

describe('ReserveIdempotencyUseCase', () => {
  let repo: InMemoryIdempotencyRepository;
  let useCase: ReserveIdempotencyUseCase;

  beforeEach(() => {
    repo = new InMemoryIdempotencyRepository();
    useCase = new ReserveIdempotencyUseCase(repo);
  });

  const baseRequest = {
    tenantId: 'tenant-001',
    organizationId: 'org-001',
    scope: 'sales.order.create',
    key: 'idem-key-1',
  };

  it('first request returns ACQUIRED', async () => {
    const result = await useCase.execute(baseRequest);
    expect(result.status).toBe('ACQUIRED');
    if (result.status === 'ACQUIRED') {
      expect(result.reservation.id).toBeDefined();
      expect(result.reservation.claimToken).toBeDefined();
      expect(result.reservation.version).toBe(1);
    }
  });

  it('same key returns IN_PROGRESS for concurrent request', async () => {
    await useCase.execute(baseRequest);
    const result = await useCase.execute(baseRequest);
    expect(result.status).toBe('IN_PROGRESS');
  });

  it('COMPLETED row returns REPLAY with stored result', async () => {
    const first = await useCase.execute(baseRequest);
    expect(first.status).toBe('ACQUIRED');
    if (first.status === 'ACQUIRED') {
      await repo.complete(first.reservation.id, first.reservation.claimToken, first.reservation.version, { id: 'order-1' });
    }

    const result = await useCase.execute(baseRequest);
    expect(result.status).toBe('REPLAY');
    if (result.status === 'REPLAY') {
      expect(result.result).toEqual({ id: 'order-1' });
    }
  });

  it('FAILED row can be re-acquired', async () => {
    const first = await useCase.execute(baseRequest);
    expect(first.status).toBe('ACQUIRED');
    if (first.status === 'ACQUIRED') {
      await repo.fail(first.reservation.id, first.reservation.claimToken, first.reservation.version);
    }

    const result = await useCase.execute(baseRequest);
    expect(result.status).toBe('ACQUIRED');
    if (result.status === 'ACQUIRED') {
      expect(result.reservation.version).toBeGreaterThan(1);
    }
  });

  it('requestHash mismatch returns KEY_REUSED', async () => {
    const first = await useCase.execute({ ...baseRequest, requestHash: 'hash-A' });
    expect(first.status).toBe('ACQUIRED');
    if (first.status === 'ACQUIRED') {
      await repo.complete(first.reservation.id, first.reservation.claimToken, first.reservation.version, { id: 'order-1' });
    }

    const result = await useCase.execute({ ...baseRequest, requestHash: 'hash-B' });
    expect(result.status).toBe('KEY_REUSED');
  });

  it('SUSPENDED row can be re-acquired', async () => {
    const first = await useCase.execute(baseRequest);
    expect(first.status).toBe('ACQUIRED');
    if (first.status === 'ACQUIRED') {
      // Directly set claimedAt to the past so suspendExpiredClaims catches it
      const identity = { tenantId: 'tenant-001', organizationId: 'org-001', scope: 'sales.order.create', key: 'idem-key-1' };
      const row = (repo as unknown as { rows: Array<{ claimedAt: Date | null; status: string }> }).rows.find(
        (r) => r.status === 'IN_PROGRESS',
      );
      if (row) row.claimedAt = new Date(Date.now() - 600_000);
      await repo.suspendExpiredClaims(300_000);
    }

    const result = await useCase.execute(baseRequest);
    expect(result.status).toBe('ACQUIRED');
  });
});
