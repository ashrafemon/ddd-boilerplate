import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@config/config.service';
import { ReleaseOutboxClaimUseCase } from './usecases/release-outbox-claim.usecase';

/**
 * Outbox reconciler — background recovery for expired claims.
 *
 * Identifies abandoned CLAIMED claims whose lease has expired
 * and releases them for retry by another worker.
 */
@Injectable()
export class OutboxReconciler {
  private readonly logger = new Logger(OutboxReconciler.name);

  constructor(
    private readonly releaseClaim: ReleaseOutboxClaimUseCase,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, { name: 'reconcile-outbox-claims' })
  async reconcileExpiredClaims(): Promise<void> {
    const { claimLeaseMs } = this.config.getOutbox();
    const cutoff = new Date(Date.now() - claimLeaseMs);
    await this.releaseClaim.execute(cutoff);
  }
}
