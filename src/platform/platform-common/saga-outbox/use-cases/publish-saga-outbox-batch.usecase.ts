import { Injectable } from '@nestjs/common';
import { ConfigService } from '@config/config.service';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { InProcessEventBus } from '@platform/platform-common/events/inbound/ports/in-process-event-bus.port';
import { MessageQueuePort } from '@platform/platform-common/messaging/inbound/ports/message-queue.port';
import { PublishPendingBatchUseCase } from '@platform/platform-common/outbox/use-cases/publish-pending-batch.usecase';
import { SagaOutboxRepositoryPort } from '../outbound/ports/saga-outbox.repository.port';

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
    repository: SagaOutboxRepositoryPort,
    messageQueue: MessageQueuePort,
    eventBus: InProcessEventBus,
    requestContext: RequestContextPort,
    config: ConfigService,
  ) {
    super(repository, messageQueue, eventBus, requestContext, config);
  }
}
