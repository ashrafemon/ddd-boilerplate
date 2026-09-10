import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { ConfigService } from '@config/config.service';
import { DispatchDueJobsPort } from './ports/dispatch-due-jobs.port';
import { ReconcileMissedJobsPort } from './ports/reconcile-missed-jobs.port';

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
    private readonly dispatch: DispatchDueJobsPort,
    private readonly reconcile: ReconcileMissedJobsPort,
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
      this.logger.error(`Scheduler tick failed: ${(err as Error).message}`);
      return 0;
    } finally {
      this.ticking = false;
    }
  }

  async reconcileOnce(): Promise<number> {
    try {
      return await this.reconcile.execute();
    } catch (err) {
      this.logger.error(`Scheduler reconcile failed: ${(err as Error).message}`);
      return 0;
    }
  }
}
