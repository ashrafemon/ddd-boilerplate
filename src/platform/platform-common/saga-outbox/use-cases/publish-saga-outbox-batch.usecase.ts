import { Injectable } from '@nestjs/common';
import { ConfigService } from '@config/config.service';
import { PublishPendingBatchUseCase } from '@platform/platform-common/outbox/use-cases/publish-pending-batch.usecase';
import { PublishPendingBatchService } from '@platform/platform-common/outbox/services/publish-pending-batch.service';
import { PrismaSagaOutboxRepository } from '../repositories/prisma-saga-outbox.repository';

/**
 * Use case: publish a batch of due `saga_outbox` messages.
 *
 * Reuses the shared publisher wholesale — claim (SKIP LOCKED + lease) → broker →
 * in-process emit on the same envelope → CAS settle, with the same failure
 * routing (backoff, DEAD_LETTER, FAILED for misconfiguration). Only the ledger
 * it claims from is the saga's own.
 */
@Injectable()
export class PublishSagaOutboxBatchUseCase extends PublishPendingBatchUseCase {
  constructor(
    repository: PrismaSagaOutboxRepository,
    dispatch: PublishPendingBatchService,
    config: ConfigService,
  ) {
    super(repository, dispatch, config);
  }
}
