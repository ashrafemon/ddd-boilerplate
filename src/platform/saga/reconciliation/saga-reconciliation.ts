import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@config/config.service';
import { SagaRepositoryPort } from '../ports/saga-repository.port';

/**
 * Saga reconciler — background recovery for expired step claims.
 *
 * Identifies abandoned CLAIMED step executions whose lease has expired
 * and releases them for retry or suspends them if retry limits
 * have been exhausted.
 */
@Injectable()
export class SagaReconciler {
  private readonly logger = new Logger(SagaReconciler.name);

  constructor(
    private readonly repository: SagaRepositoryPort,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, { name: 'reconcile-saga-steps' })
  async reconcileExpiredStepClaims(): Promise<void> {
    const { stepClaimLeaseMs } = this.config.getSaga();
    const now = new Date();
    const released = await this.repository.releaseExpiredStepClaims(now, stepClaimLeaseMs);
    if (released > 0) {
      this.logger.log(`Released ${released} expired saga step claims`);
    }
  }
}
