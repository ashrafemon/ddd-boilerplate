import { ConflictException, NotFoundException } from '@nestjs/common';
import { TenantScope } from '@shared-kernel/utils/tenant-scope.util';
import { randomUUID } from 'crypto';
import { ImportJobRepositoryPort } from '../ports/import-job-repository.port';
import { ImportJobRecord } from '../import.types';

/** Shared by the parse/validate/execute stages — a job built by an older deploy must not resume mid-pipeline under a changed build. */
export class ImportBuildGuard {
  static assert(job: ImportJobRecord, currentBuildSha: string): void {
    if (job.buildSha && job.buildSha !== currentBuildSha) {
      throw new ConflictException(
        `ImportJob '${job.id}' was parsed by build ${job.buildSha} but this instance runs ${currentBuildSha}`,
      );
    }
  }

  /**
   * Behaviour-affecting descriptor changes (fields, required-ness, chunking)
   * must bump descriptor.version; a job may only continue on the shape it was
   * created with, otherwise validation would run on the snapshot while
   * execution uses a different live contract.
   */
  static assertDescriptorCurrent(
    job: ImportJobRecord,
    currentVersion: number,
    entityKey: string,
  ): void {
    if (job.descriptorVersion !== currentVersion) {
      throw new ConflictException(
        `Import handler '${entityKey}' is at descriptor v${currentVersion} but ` +
          `ImportJob '${job.id}' was created against v${job.descriptorVersion}; create a new job`,
      );
    }
  }
}

/** Renewing stage lock: acquire once, heartbeat while the phase runs, release at the end. */
export class StageLock {
  static async acquire(
    jobs: ImportJobRepositoryPort,
    jobId: string,
    stage: string,
    ttlMs: number,
    renewMs: number,
  ): Promise<(() => Promise<void>) | null> {
    const owner = `${stage}:${randomUUID()}`;
    if (!(await jobs.tryAcquireLock(jobId, owner, new Date(Date.now() + ttlMs)))) {
      return null;
    }
    const timer = setInterval(() => {
      void jobs.heartbeat(jobId, owner, new Date(Date.now() + ttlMs)).catch(() => undefined);
    }, renewMs);
    return async () => {
      clearInterval(timer);
      await jobs.releaseLock(jobId, owner).catch(() => undefined);
    };
  }
}

export async function requireVisibleJob(
  jobs: ImportJobRepositoryPort,
  jobId: string,
  tenantId?: string,
): Promise<ImportJobRecord> {
  const job = await jobs.findById(jobId);
  if (!job) {
    throw new NotFoundException(`ImportJob '${jobId}' not found`);
  }
  TenantScope.assertVisible(job.tenantId ?? null, tenantId);
  return job;
}
