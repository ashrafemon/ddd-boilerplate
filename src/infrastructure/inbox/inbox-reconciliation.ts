import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@config/config.service';
import { PrismaInboxRepository } from './repositories/prisma-inbox.repository';

/**
 * Inbox reconciler — the consumer-side sweep.
 *
 * Expired IN_PROGRESS claims (`attempts > maxAttempts`) park as SUSPENDED for
 * alert + manual recovery; the rest get a fresh exponential backoff for the
 * next redelivery. The same sweep deletes PROCESSED rows past retention —
 * SUSPENDED rows never purge.
 */
@Injectable()
export class InboxReconciler {
  private readonly logger = new Logger(InboxReconciler.name);

  constructor(
    private readonly repository: PrismaInboxRepository,
    private readonly configService: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, { name: 'reconcile-inbox' })
  async reconcile(): Promise<void> {
    const { claimLeaseMs, maxAttempts, retryBaseDelayMs, retryMaxDelayMs, processedRetentionMs } =
      this.configService.getInbox();

    const reconciled = await this.repository.reconcileExpiredClaims(
      new Date(),
      claimLeaseMs,
      maxAttempts,
      retryBaseDelayMs,
      retryMaxDelayMs,
    );
    if (reconciled > 0) {
      this.logger.log(`Reconciled ${reconciled} expired inbox claims`);
    }

    const purged = await this.repository.deleteProcessedOlderThan(processedRetentionMs);
    if (purged > 0) {
      this.logger.log(`Purged ${purged} processed inbox messages past retention`);
    }
  }
}
