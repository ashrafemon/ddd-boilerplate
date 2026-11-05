import { FailureMessage } from '@shared-kernel/utils/failure-message.util';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { ConfigService } from '@config/config.service';
import { DispatchDueJobsUseCase } from './usecases/dispatch-due-jobs.usecase';
import { ReconcileMissedJobsUseCase } from './usecases/reconcile-missed-jobs.usecase';

const TICK_INTERVAL = 'scheduler-tick';
const RECONCILE_INTERVAL = 'scheduler-reconcile';

/**
 * Time-driven adapter: polls dispatch + reconcile on intervals.
 * Thin — all logic lives in use cases.
 */
@Injectable()
export class SchedulerTicker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SchedulerTicker.name);
  private ticking = false;

  constructor(
    private readonly dispatch: DispatchDueJobsUseCase,
    private readonly reconcile: ReconcileMissedJobsUseCase,
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    const { pollIntervalMs, reconciliationIntervalMs } = this.configService.getScheduler();
    this.schedulerRegistry.addInterval(
      TICK_INTERVAL,
      setInterval(() => void this.tick(), pollIntervalMs),
    );
    this.schedulerRegistry.addInterval(
      RECONCILE_INTERVAL,
      setInterval(() => void this.reconcileOnce(), reconciliationIntervalMs),
    );
  }

  onModuleDestroy(): void {
    for (const name of [TICK_INTERVAL, RECONCILE_INTERVAL]) {
      if (this.schedulerRegistry.doesExist('interval', name)) {
        this.schedulerRegistry.deleteInterval(name);
      }
    }
  }

  async tick(): Promise<number> {
    if (this.ticking) {
      return 0;
    }
    this.ticking = true;
    try {
      return await this.dispatch.execute();
    } catch (err) {
      this.logger.error(`Scheduler tick failed: ${FailureMessage.of(err)}`);
      return 0;
    } finally {
      this.ticking = false;
    }
  }

  async reconcileOnce(): Promise<number> {
    try {
      return await this.reconcile.execute();
    } catch (err) {
      this.logger.error(`Scheduler reconcile failed: ${FailureMessage.of(err)}`);
      return 0;
    }
  }
}
