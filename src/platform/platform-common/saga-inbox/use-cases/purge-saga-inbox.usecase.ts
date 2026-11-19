import { Injectable } from '@nestjs/common';
import { ConfigService } from '@config/config.service';
import { PrismaSagaInboxRepository } from '../repositories/prisma-saga-inbox.repository';

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
    private readonly inbox: PrismaSagaInboxRepository,
    private readonly configService: ConfigService,
  ) {}

  async execute(): Promise<number> {
    const { inboxRetentionDays } = this.configService.getSaga();
    return this.inbox.purgeOlderThan(inboxRetentionDays);
  }
}
