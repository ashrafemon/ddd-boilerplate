import { Injectable } from '@nestjs/common';
import { ConfigService } from '@config/config.service';
import { PurgePublishedOutboxUseCase } from '@platform/platform-common/outbox/use-cases/purge-published-outbox.usecase';
import { SagaOutboxRepositoryPort } from '../outbound/ports/saga-outbox.repository.port';

/**
 * Use case: delete PUBLISHED `saga_outbox` rows past the retention window.
 *
 * Same retention rule as the shared outbox (only PUBLISHED rows are ever
 * deleted), applied to the saga's ledger.
 */
@Injectable()
export class PurgePublishedSagaOutboxUseCase extends PurgePublishedOutboxUseCase {
  constructor(repository: SagaOutboxRepositoryPort, configService: ConfigService) {
    super(repository, configService);
  }
}
