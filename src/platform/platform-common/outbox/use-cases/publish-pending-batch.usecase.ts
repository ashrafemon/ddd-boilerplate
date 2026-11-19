import { Injectable } from '@nestjs/common';
import { ConfigService } from '@config/config.service';
import { PrismaOutboxRepository } from '../repositories/prisma-outbox.repository';
import { PublishPendingBatchService } from '../services/publish-pending-batch.service';

/**
 * Use case: publish a batch of pending outbox messages.
 *
 * claimBatch (SKIP LOCKED + lease clause, status → PUBLISHING) → publish to the
 * broker named by the envelope → emit in-process on the same envelope →
 * CAS-settle each row.
 *
 * Per-row dispatch (publish, emit, settle, failure routing) lives in
 * `PublishPendingBatchService`; this use case only claims the batch and fans
 * each row out to that service.
 *
 * Failure routing:
 *  - transport error → back to PENDING with exponential backoff, DEAD_LETTER
 *    once `attempts` exceeds the ceiling;
 *  - missing broker configuration (`UnsupportedBrokerTargetError`) → FAILED,
 *    parked for an operator, because retrying cannot fix configuration.
 *
 * No reconciler — a crashed owner stays PUBLISHING and the next tick reclaims
 * it once the lease expires, through the same clause.
 */
@Injectable()
export class PublishPendingBatchUseCase {
  constructor(
    private readonly repository: PrismaOutboxRepository,
    private readonly dispatch: PublishPendingBatchService,
    private readonly config: ConfigService,
  ) {}

  async execute(): Promise<number> {
    const { batchSize, maxAttempts, claimLeaseMs } = this.config.getOutbox();
    const messages = await this.repository.claimBatch({
      batchSize,
      maxAttempts,
      claimLeaseMs,
    });

    for (const message of messages) {
      await this.dispatch.dispatchOne(message, maxAttempts);
    }

    return messages.length;
  }
}
