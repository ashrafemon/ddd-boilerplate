import { Injectable } from '@nestjs/common';
import { DistributedLockPort } from '../ports/distributed-lock.port';
import {
  DistributedLockAcquireRequest,
  DistributedLockAcquireResult,
  DistributedLockRenewRequest,
  DistributedLockRenewResult,
  DistributedLockReleaseRequest,
} from '../../types/locking.types';
import { AcquireDistributedLockUseCase } from '../../use-cases/acquire-distributed-lock.usecase';
import { ReleaseDistributedLockUseCase } from '../../use-cases/release-distributed-lock.usecase';
import { RenewDistributedLockUseCase } from '../../use-cases/renew-distributed-lock.usecase';

/**
 * Inbound adapter implementing the public `DistributedLockPort`
 * (design `common/03-lock`).
 *
 * Delegates one operation per use case and holds no rules of its own. The
 * module binds `{ provide: DistributedLockPort, useExisting: LockAdapter }`, so
 * business modules never see this class.
 */
@Injectable()
export class LockAdapter implements DistributedLockPort {
  constructor(
    private readonly acquireUseCase: AcquireDistributedLockUseCase,
    private readonly renewUseCase: RenewDistributedLockUseCase,
    private readonly releaseUseCase: ReleaseDistributedLockUseCase,
  ) {}

  async acquire(request: DistributedLockAcquireRequest): Promise<DistributedLockAcquireResult> {
    return this.acquireUseCase.execute(request);
  }

  async renew(request: DistributedLockRenewRequest): Promise<DistributedLockRenewResult> {
    return this.renewUseCase.execute(request);
  }

  async release(request: DistributedLockReleaseRequest): Promise<void> {
    return this.releaseUseCase.execute(request);
  }
}
