import { Injectable } from '@nestjs/common';
import { DistributedLockPort } from './ports/distributed-lock.port';
import { AcquireDistributedLockUseCase } from './usecases/acquire-distributed-lock.usecase';
import { RenewDistributedLockUseCase } from './usecases/renew-distributed-lock.usecase';
import { ReleaseDistributedLockUseCase } from './usecases/release-distributed-lock.usecase';
import {
  DistributedLockAcquireRequest,
  DistributedLockAcquireResult,
  DistributedLockRenewRequest,
  DistributedLockRenewResult,
  DistributedLockReleaseRequest,
} from './locking.types';

/**
 * Distributed lock service facade — the single entry point for all lock operations.
 *
 * Delegates to individual use cases (one per file) without containing
 * business rules itself. This class implements the public DistributedLockPort.
 */
@Injectable()
export class DistributedLockService implements DistributedLockPort {
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
