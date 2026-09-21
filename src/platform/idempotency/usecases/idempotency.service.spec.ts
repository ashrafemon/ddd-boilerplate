import { CompleteIdempotencyUseCase } from './complete-idempotency.usecase';
import { FailIdempotencyUseCase } from './fail-idempotency.usecase';
import { ReserveIdempotencyUseCase } from './reserve-idempotency.usecase';
import { InMemoryIdempotencyRepository } from '../__testing__/in-memory-idempotency.repository';

describe('CompleteIdempotencyUseCase', () => {
  let repo: InMemoryIdempotencyRepository;
  let reserve: ReserveIdempotencyUseCase;
  let complete: CompleteIdempotencyUseCase;

  beforeEach(() => {
    repo = new InMemoryIdempotencyRepository();
    reserve = new ReserveIdempotencyUseCase(repo);
    complete = new CompleteIdempotencyUseCase(repo);
  });

  it('completes an ACQUIRED reservation', async () => {
    const result = await reserve.execute({
      tenantId: 't1',
      organizationId: 'o1',
      scope: 'test',
      key: 'k1',
    });
    expect(result.status).toBe('ACQUIRED');
    if (result.status === 'ACQUIRED') {
      await complete.execute({ reservation: result.reservation, result: { id: '1' } });
      const replay = await reserve.execute({
        tenantId: 't1',
        organizationId: 'o1',
        scope: 'test',
        key: 'k1',
      });
      expect(replay.status).toBe('REPLAY');
    }
  });
});

describe('FailIdempotencyUseCase', () => {
  let repo: InMemoryIdempotencyRepository;
  let reserve: ReserveIdempotencyUseCase;
  let fail: FailIdempotencyUseCase;

  beforeEach(() => {
    repo = new InMemoryIdempotencyRepository();
    reserve = new ReserveIdempotencyUseCase(repo);
    fail = new FailIdempotencyUseCase(repo);
  });

  it('fails an ACQUIRED reservation', async () => {
    const result = await reserve.execute({
      tenantId: 't1',
      organizationId: 'o1',
      scope: 'test',
      key: 'k1',
    });
    expect(result.status).toBe('ACQUIRED');
    if (result.status === 'ACQUIRED') {
      await fail.execute({
        reservation: result.reservation,
        errorCode: 'INTERNAL_ERROR',
        errorMessage: 'Something went wrong',
      });
      // Should be re-acquirable
      const retry = await reserve.execute({
        tenantId: 't1',
        organizationId: 'o1',
        scope: 'test',
        key: 'k1',
      });
      expect(retry.status).toBe('ACQUIRED');
    }
  });
});
