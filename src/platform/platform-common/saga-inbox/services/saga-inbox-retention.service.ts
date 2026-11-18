import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PurgeSagaInboxUseCase } from '../use-cases/purge-saga-inbox.usecase';

/**
 * Scheduled orchestration for `saga_inbox`: the retention sweep.
 *
 * The redelivery window is a config knob (`SAGA_INBOX_RETENTION_DAYS`), and the
 * sweep only ever deletes rows older than it — a dedupe row that disappeared too
 * early would let a broker redelivery run the same step twice.
 */
@Injectable()
export class SagaInboxRetentionService {
  private readonly logger = new Logger(SagaInboxRetentionService.name);

  constructor(private readonly purgeInbox: PurgeSagaInboxUseCase) {}

  @Cron(CronExpression.EVERY_HOUR, { name: 'cleanup-saga-inbox' })
  async purge(): Promise<void> {
    const deleted = await this.purgeInbox.execute();
    if (deleted > 0) {
      this.logger.log(`Purged ${deleted} saga inbox rows past retention`);
    }
  }
}
