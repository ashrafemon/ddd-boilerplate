import { ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { FailureMessage } from '@shared-kernel/utils/failure-message.util';
import { ConfigService } from '@config/config.service';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { ImportHandlerRegistry } from '../import-handler.registry';
import { ImportJobOutboxWriterPort } from '../ports/import-job-outbox-writer.port';
import { ImportJobRepositoryPort } from '../ports/import-job-repository.port';
import { ImportJobRowRepositoryPort } from '../ports/import-job-row-repository.port';
import { ImportContext, RowExecutionSettlement, RowResult } from '../import.types';
import { ImportBuildGuard, StageLock } from './import-helpers';

@Injectable()
export class RunImportExecutionUseCase {
  private readonly logger = new Logger(RunImportExecutionUseCase.name);

  constructor(
    private readonly registry: ImportHandlerRegistry,
    private readonly config: ConfigService,
    @Inject(ImportJobRepositoryPort) private readonly jobs: ImportJobRepositoryPort,
    @Inject(ImportJobRowRepositoryPort) private readonly rows: ImportJobRowRepositoryPort,
    @Inject(ImportJobOutboxWriterPort) private readonly outbox: ImportJobOutboxWriterPort,
    @Inject(RequestContextPort) private readonly requestContext: RequestContextPort,
  ) {}

  async execute(jobId: string): Promise<void> {
    const job = await this.jobs.findById(jobId);
    if (!job) return;
    await this.requestContext.run({ tenantId: job.tenantId, correlationId: job.traceId }, () =>
      this.runExecute(jobId),
    );
  }

  private async runExecute(jobId: string): Promise<void> {
    const cfg = this.config.getImport();
    const release = await StageLock.acquire(
      this.jobs,
      jobId,
      'execute',
      cfg.reconciliationWindowMs,
      cfg.lockRenewalMs,
    );
    if (!release) {
      this.logger.debug(`Execute skipped for import job ${jobId}: locked by a live worker`);
      return;
    }

    const job = await this.jobs.findById(jobId);
    if (!job) throw new NotFoundException(`ImportJob '${jobId}' not found`);
    ImportBuildGuard.assert(job, cfg.buildSha);
    const handler = this.registry.resolveHandler(job.entityKey);
    ImportBuildGuard.assertDescriptorCurrent(
      job,
      this.registry.resolveDescriptor(job.entityKey).version,
      job.entityKey,
    );
    if (['COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED', 'CANCELLED'].includes(job.status)) {
      return;
    }
    if (job.status !== 'EXECUTING') {
      throw new ConflictException(
        `ImportJob '${job.id}' is ${job.status}; expected one of: EXECUTING`,
      );
    }

    const chunkSize = job.descriptorSnapshot.executionChunkSize || cfg.executionChunkSize;
    const ctx: ImportContext = {
      tenantId: job.tenantId,
      userId: job.requestedBy,
      jobId: job.id,
      traceId: job.traceId,
      options: job.options ?? {},
    };

    try {
      for (;;) {
        if (await this.jobs.isCancelRequested(job.id)) {
          const cancelled = await this.jobs.markTerminal(job.id, 'CANCELLED', {
            from: 'EXECUTING',
            to: 'CANCELLED',
            at: new Date(),
          });
          if (cancelled) {
            await this.outbox.writeCancelledEvent(cancelled);
          }
          return;
        }
        const claimed = await this.rows.claimForExecution(job.id, chunkSize);
        if (claimed.length === 0) break;

        const tokens = new Map(
          claimed.map(r => [r.rowNumber, r.executionClaimToken ?? -1] as const),
        );
        const settle = (rowNumber: number, result: RowResult): RowExecutionSettlement => ({
          ...result,
          executionClaimToken: tokens.get(rowNumber) ?? -1,
        });

        // Re-validate inside execution chunk (staleness guard).
        const payloads = claimed.map(r => ({
          rowNumber: r.rowNumber,
          ...(r.mappedPayload ?? {}),
        }));
        const refs = await handler.preloadReferences(payloads, ctx);
        const verdicts = await handler.validateBatch(payloads, refs, ctx);
        const stillValid = new Set(
          verdicts.filter(v => v.status === 'VALID').map(v => v.rowNumber),
        );
        const skipResults: RowExecutionSettlement[] = verdicts
          .filter(v => v.status !== 'VALID')
          .map(v =>
            settle(v.rowNumber, {
              rowNumber: v.rowNumber,
              status: 'SKIPPED' as const,
              errorMessage: (v.errors ?? ['re-validation failed']).join('; '),
            }),
          );
        if (skipResults.length) {
          await this.rows.applyExecutionResults(job.id, skipResults);
        }

        const toExecute = payloads.filter(p => stillValid.has(p.rowNumber));
        if (toExecute.length) {
          const executingRows = claimed
            .filter(r => stillValid.has(r.rowNumber))
            .map(r => r.rowNumber);
          try {
            const results = await handler.executeBatch(toExecute, ctx);
            await this.rows.applyExecutionResults(
              job.id,
              results.map(r => settle(r.rowNumber, r)),
            );
            // Results missing from the handler response (crash-free contract
            // breach) must not leave PROCESSING rows pinning the loop.
            const answered = new Set(results.map(r => r.rowNumber));
            const unanswered: RowExecutionSettlement[] = executingRows
              .filter(rowNumber => !answered.has(rowNumber))
              .map(rowNumber =>
                settle(rowNumber, {
                  rowNumber,
                  status: 'FAILED' as const,
                  errorMessage: 'handler returned no execution result',
                }),
              );
            if (unanswered.length) {
              await this.rows.applyExecutionResults(job.id, unanswered);
            }
          } catch (err) {
            // Chunk-level failure: the domain commits inside the handler are
            // opaque from here, so mark the whole claimed chunk FAILED for
            // operator review and keep the pipeline moving instead of
            // terminalising the job on one bad batch.
            const message = FailureMessage.of(err);
            this.logger.error(
              `Import execution chunk failed for job ${job.id}: ${message} — ${toExecute.length} rows marked FAILED`,
            );
            await this.rows.applyExecutionResults(
              job.id,
              executingRows.map(rowNumber =>
                settle(rowNumber, {
                  rowNumber,
                  status: 'FAILED' as const,
                  errorMessage: message,
                }),
              ),
            );
          }
        }
        await this.jobs.recountCounters(job.id);
      }

      const fresh = await this.jobs.recountCounters(job.id);
      const hasErrors = fresh !== null && (fresh.failedRows > 0 || fresh.invalidRows > 0);
      const status = hasErrors ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED';
      const completed = await this.jobs.markTerminal(job.id, status, {
        from: 'EXECUTING',
        to: status,
        at: new Date(),
      });
      if (completed) {
        await this.outbox.writeCompletedEvent(completed);
      }
    } catch (err) {
      const failed = await this.jobs.markTerminal(job.id, 'FAILED', {
        from: 'EXECUTING',
        to: 'FAILED',
        at: new Date(),
        detail: FailureMessage.of(err),
      });
      if (failed) {
        await this.outbox.writeFailedEvent(failed);
      }
      throw err;
    } finally {
      await release();
    }
  }
}
