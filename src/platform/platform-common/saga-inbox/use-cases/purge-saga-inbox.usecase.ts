import { Injectable } from '@nestjs/common';
import { ConfigService } from '@config/config.service';
import { SagaInboxRepositoryPort } from '../outbound/ports/saga-inbox.repository.port';

/**
 * Use case: delete saga inbox rows past the redelivery window.
 *
 * Runs hourly from `SagaInboxRetentionService`. The window is
 * `SAGA_INBOX_RETENTION_DAYS` — long enough that a broker redelivery can never
 * find its dedupe row gone.
 */
@Injectable()
export class PurgeSagaInboxUseCase {
  constructor(
    private readonly inbox: SagaInboxRepositoryPort,
    private readonly configService: ConfigService,
  ) {}

  async execute(): Promise<number> {
    const { inboxRetentionDays } = this.configService.getSaga();
    return this.inbox.purgeOlderThan(inboxRetentionDays);
  }
}
