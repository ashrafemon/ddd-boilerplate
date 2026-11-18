import { Injectable, Logger } from '@nestjs/common';
import { hostname } from 'node:os';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@config/config.service';
import { SagaStepRepositoryPort } from '../outbound/ports/saga-step.repository.port';

/** Marker written when a claim outlived its lease (crashed worker). */
export const STALE_LEASE_ERROR = 'lease expired before the step settled';

/**
 * Worker tick: claim due `saga_steps` rows and hand each to its use case.
 *
 * The claim itself is the concurrency guard (`FOR UPDATE SKIP LOCKED` + lease);
 * the worker keeps no in-memory queue, so a crash loses nothing.
 */
@Injectable()
export class SagaStepWorkerService {
  private readonly logger = new Logger(SagaStepWorkerService.name);
  private readonly workerId = `${hostname()}:${process.pid}:${randomUUID()}`;

  constructor(
    private readonly steps: SagaStepRepositoryPort,
    private readonly configService: ConfigService,
  ) {}

  async claimBatch(): Promise<ReturnType<SagaStepRepositoryPort['claimBatch']>> {
    const config = this.configService.getSaga();
    const claimed = await this.steps.claimBatch({
      now: new Date(),
      leaseMs: config.workerLeaseSeconds * 1000,
      batchSize: config.claimBatchSize,
      workerId: this.workerId,
      fairnessCap: config.fairnessCap,
    });
    if (claimed.length > 0) {
      this.logger.debug(`Claimed ${claimed.length} saga steps`);
    }
    return claimed;
  }
}
