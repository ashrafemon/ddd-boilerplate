import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@config/config.service';
import { FileStoragePort } from '@platform/platform-common/storage/ports/file-storage.port';
import { ImportFileParser } from '../import-file.parser';
import { ImportJobOutboxWriterPort } from '../ports/import-job-outbox-writer.port';
import { ImportJobRepositoryPort } from '../ports/import-job-repository.port';
import { ImportJobRowRepositoryPort } from '../ports/import-job-row-repository.port';
import { StorageObjectRepositoryPort } from '../ports/storage-object-repository.port';
import { ImportBuildGuard, StageLock } from '../usecases/import-helpers';

/**
 * Service: parse stage body — acquire the stage lock, download the source
 * file, parse + map rows, persist them, and transition the job to MAPPED.
 *
 * Extracted from `ParseImportJobUseCase` so the use case keeps a single
 * `execute()` entry point (load + CLS restore) while the parse orchestration
 * lives here.
 */
@Injectable()
export class ParseImportJobService {
  private readonly logger = new Logger(ParseImportJobService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly storage: FileStoragePort,
    @Inject(ImportJobRepositoryPort) private readonly jobs: ImportJobRepositoryPort,
    @Inject(ImportJobRowRepositoryPort) private readonly rows: ImportJobRowRepositoryPort,
    @Inject(StorageObjectRepositoryPort)
    private readonly storageObjects: StorageObjectRepositoryPort,
    @Inject(ImportJobOutboxWriterPort) private readonly outbox: ImportJobOutboxWriterPort,
    private readonly parser: ImportFileParser,
  ) {}

  async process(jobId: string): Promise<void> {
    const cfg = this.config.getImport();
    const release = await StageLock.acquire(
      this.jobs,
      jobId,
      'parse',
      cfg.reconciliationWindowMs,
      cfg.lockRenewalMs,
    );
    if (!release) {
      this.logger.debug(`Parse skipped for import job ${jobId}: locked by a live worker`);
      return;
    }

    const job = await this.jobs.findById(jobId);
    if (!job) throw new NotFoundException(`ImportJob '${jobId}' not found`);
    ImportBuildGuard.assert(job, cfg.buildSha);

    if (job.status === 'MAPPED' || job.status === 'VALIDATING' || job.status === 'VALIDATED') {
      return;
    }
    if (job.status !== 'UPLOADED' && job.status !== 'PARSING') {
      throw new ConflictException(
        `ImportJob '${job.id}' is ${job.status}; expected one of: ${['UPLOADED', 'PARSING'].join(', ')}`,
      );
    }

    await this.jobs.transitionStatus(job.id, ['UPLOADED', 'PARSING'], 'PARSING', {
      from: job.status,
      to: 'PARSING',
      at: new Date(),
    });

    try {
      const obj = job.sourceStorageObjectId
        ? await this.storageObjects.findById(job.sourceStorageObjectId)
        : null;
      if (!obj) throw new NotFoundException(`Import source file is missing for '${job.id}'`);
      const downloaded = await this.storage.download(obj.storageKey);
      const maxRows = Math.min(job.descriptorSnapshot.maxRows, cfg.maxRows);
      const parsed = this.parser.parseFile(
        downloaded.body,
        obj.contentType ?? downloaded.contentType,
        obj.storageKey,
        maxRows + 1,
      );
      if (parsed.rows.length > maxRows) {
        throw new BadRequestException(
          `Import file for '${job.entityKey}' has ${parsed.rows.length} rows, above the ${maxRows}-row limit`,
        );
      }

      await this.rows.deleteByJob(job.id);
      const mapping = this.parser.suggestMapping(parsed.headers, job.descriptorSnapshot);
      const chunk: Parameters<ImportJobRowRepositoryPort['bulkInsert']>[0] = [];
      for (const row of parsed.rows) {
        chunk.push({
          tenantId: job.tenantId,
          importJobId: job.id,
          rowNumber: row.rowNumber,
          rawPayload: row.values,
          mappedPayload: this.parser.applyMapping(row.values, mapping),
        });
        if (chunk.length >= 500) {
          await this.rows.bulkInsert(chunk);
          chunk.length = 0;
        }
      }
      if (chunk.length) await this.rows.bulkInsert(chunk);

      await this.jobs.setColumnMapping(job.id, mapping);
      await this.jobs.updateCounters(job.id, { totalRows: parsed.rows.length });
      await this.jobs.transitionStatus(job.id, 'PARSING', 'MAPPED', {
        from: 'PARSING',
        to: 'MAPPED',
        at: new Date(),
        detail: `parsed ${parsed.rows.length} rows`,
      });
    } catch (err) {
      const failed = await this.jobs.markTerminal(job.id, 'FAILED', {
        from: 'PARSING',
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
