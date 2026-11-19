import { ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@config/config.service';
import { ImportHandlerRegistry } from '../import-handler.registry';
import { ImportFileParser } from '../import-file.parser';
import { ImportJobOutboxWriterPort } from '../ports/import-job-outbox-writer.port';
import { ImportJobRepositoryPort } from '../ports/import-job-repository.port';
import { ImportJobRowRepositoryPort } from '../ports/import-job-row-repository.port';
import { ImportContext, ImportJobRowRecord, RowVerdict } from '../import.types';
import { ImportBuildGuard, StageLock } from '../usecases/import-helpers';

/**
 * Service: validation stage body — acquire the stage lock, drain pending rows
 * in chunks (structural checks then handler domain verdicts), and transition
 * the job to VALIDATED.
 *
 * Extracted from `ValidateImportJobUseCase` so the use case keeps a single
 * `execute()` entry point (load + CLS restore) while the validation
 * orchestration lives here.
 */
@Injectable()
export class ValidateImportJobService {
  private readonly logger = new Logger(ValidateImportJobService.name);

  constructor(
    private readonly registry: ImportHandlerRegistry,
    private readonly config: ConfigService,
    @Inject(ImportJobRepositoryPort) private readonly jobs: ImportJobRepositoryPort,
    @Inject(ImportJobRowRepositoryPort) private readonly rows: ImportJobRowRepositoryPort,
    @Inject(ImportJobOutboxWriterPort) private readonly outbox: ImportJobOutboxWriterPort,
    private readonly parser: ImportFileParser,
  ) {}

  async process(jobId: string): Promise<void> {
    const cfg = this.config.getImport();
    const release = await StageLock.acquire(
      this.jobs,
      jobId,
      'validate',
      cfg.reconciliationWindowMs,
      cfg.lockRenewalMs,
    );
    if (!release) {
      this.logger.debug(`Validate skipped for import job ${jobId}: locked by a live worker`);
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
    if (job.status === 'VALIDATED' || job.status === 'EXECUTING') return;
    if (job.status !== 'VALIDATING' && job.status !== 'MAPPED') {
      throw new ConflictException(
        `ImportJob '${job.id}' is ${job.status}; expected one of: ${['MAPPED', 'VALIDATING'].join(', ')}`,
      );
    }
    if (job.status === 'MAPPED') {
      await this.jobs.transitionStatus(job.id, 'MAPPED', 'VALIDATING', {
        from: 'MAPPED',
        to: 'VALIDATING',
        at: new Date(),
      });
    }

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
            from: 'VALIDATING',
            to: 'CANCELLED',
            at: new Date(),
          });
          if (cancelled) {
            await this.outbox.writeCancelledEvent(cancelled);
          }
          return;
        }
        const pending = await this.rows.listPendingValidation(job.id, cfg.validationChunkSize);
        if (pending.length === 0) break;

        const structural: RowVerdict[] = [];
        const domainCandidates: ImportJobRowRecord[] = [];
        for (const row of pending) {
          const mapped = row.mappedPayload ?? {};
          const errors = this.parser.structuralValidateRow(mapped, job.descriptorSnapshot);
          if (errors.length) {
            structural.push({ rowNumber: row.rowNumber, status: 'INVALID', errors });
          } else {
            domainCandidates.push(row);
          }
        }
        if (structural.length) {
          await this.rows.applyValidationVerdicts(job.id, structural);
        }
        if (domainCandidates.length) {
          const payloads = domainCandidates.map(r => ({
            rowNumber: r.rowNumber,
            ...(r.mappedPayload ?? {}),
          }));
          const refs = await handler.preloadReferences(payloads, ctx);
          const verdicts = await handler.validateBatch(payloads, refs, ctx);
          // Termination contract: every candidate must leave PENDING, so a
          // handler that omits a verdict gets an explicit INVALID instead of
          // pinning the loop (and the worker slot) forever.
          const returned = new Set(verdicts.map(v => v.rowNumber));
          const missing: RowVerdict[] = domainCandidates
            .filter(r => !returned.has(r.rowNumber))
            .map(r => ({
              rowNumber: r.rowNumber,
              status: 'INVALID' as const,
              errors: ['handler returned no validation verdict'],
            }));
          await this.rows.applyValidationVerdicts(job.id, [...verdicts, ...missing]);
        }
        await this.jobs.recountCounters(job.id);
      }

      await this.jobs.transitionStatus(job.id, 'VALIDATING', 'VALIDATED', {
        from: 'VALIDATING',
        to: 'VALIDATED',
        at: new Date(),
      });
    } catch (err) {
      const failed = await this.jobs.markTerminal(job.id, 'FAILED', {
        from: 'VALIDATING',
        to: 'FAILED',
        at: new Date(),
        detail: err instanceof Error ? err.message : String(err),
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
