import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RecurringExecutionRepositoryPort } from '../ports/recurring-execution-repository.port';

/** IN_PROGRESS executions older than this lost their consumer (Rabbit handler died). */
const STALE_EXECUTION_MS = 60 * 60_000;
const SWEEP_BATCH = 500;

/**
 * Crash sweeper for the claim-as-insert idempotency model: an occurrence whose
 * document consumer never completed stays IN_PROGRESS forever and would block
 * regeneration of its slot. Fail them so the outcome is visible/alertable
 * (never auto-regenerate — the document may exist without the completion
 * callback having landed).
 */
@Injectable()
export class SweepStaleExecutionsUseCase {
  private readonly logger = new Logger(SweepStaleExecutionsUseCase.name);

  constructor(private readonly executions: RecurringExecutionRepositoryPort) {}

  @Cron(CronExpression.EVERY_HOUR, { name: 'sweep-stale-recurring-executions' })
  async run(): Promise<number> {
    const failed = await this.executions.failStale(
      new Date(Date.now() - STALE_EXECUTION_MS),
      SWEEP_BATCH,
    );
    if (failed > 0) {
      this.logger.warn(`Failed ${failed} stale IN_PROGRESS recurring executions`);
    }
    return failed;
  }
}
