import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@config/config.service';
import { InboxRepositoryPort } from '../outbound/ports/inbox.repository.port';

/**
 * Inbox reconciler — the consumer-side sweep.
 *
 * Expired IN_PROGRESS claims (`attempts > maxAttempts`) park as SUSPENDED for
 * alert + manual recovery; the rest get a fresh exponential backoff for the
 * next redelivery. The same sweep deletes PROCESSED rows past retention —
 * SUSPENDED rows never purge.
 */
@Injectable()
export class InboxReconciliationService {
  private readonly logger = new Logger(InboxReconciliationService.name);

  constructor(
    private readonly repository: InboxRepositoryPort,
    private readonly configService: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, { name: 'reconcile-inbox' })
  async reconcile(): Promise<void> {
    const { claimLeaseMs, maxAttempts, retryBaseDelayMs, retryMaxDelayMs, processedRetentionMs } =
      this.configService.getInbox();

    const reconciled = await this.repository.reconcileExpiredClaims({
      now: new Date(),
      claimLeaseMs,
      maxAttempts,
      retryBaseDelayMs,
      retryMaxDelayMs,
    });
    if (reconciled > 0) {
      this.logger.log(`Reconciled ${reconciled} expired inbox claims`);
    }

    const purged = await this.repository.deleteProcessedOlderThan(processedRetentionMs);
    if (purged > 0) {
      this.logger.log(`Purged ${purged} processed inbox messages past retention`);
    }
  }
}
