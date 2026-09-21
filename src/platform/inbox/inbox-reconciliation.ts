import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@config/config.service';
import { InboxRepositoryPort } from './ports/inbox-repository.port';

/**
 * Inbox reconciler — background recovery for expired claims.
 *
 * Identifies abandoned IN_PROGRESS claims whose lease has expired
 * and releases them for retry or suspends them if retry limits
 * have been exhausted.
 */
@Injectable()
export class InboxReconciler {
  private readonly logger = new Logger(InboxReconciler.name);

  constructor(
    private readonly repository: InboxRepositoryPort,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, { name: 'reconcile-inbox-claims' })
  async reconcileExpiredClaims(): Promise<void> {
    const { claimLeaseMs } = this.config.getInbox();
    const now = new Date();
    const released = await this.repository.releaseExpiredClaims(now, claimLeaseMs);
    if (released > 0) {
      this.logger.log(`Released ${released} expired inbox claims`);
    }
  }
}
