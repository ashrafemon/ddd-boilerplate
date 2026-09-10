import { ImportDescriptor } from '../import.types';
import { PresignedUpload } from '@platform/storage/ports/file-storage.port';
import { PageResult } from '@shared-kernel/types/pagination';
import { ColumnMapping, ImportJobRecord, ImportJobRowRecord, ImportOptions } from '../import.types';

export abstract class InitImportPort {
  abstract execute(input: { entityKey: string; tenantId?: string }): Promise<{
    descriptor: ImportDescriptor;
    limits: { maxRows: number; maxFileSizeBytes: number };
    recentJobs: ImportJobRecord[];
  }>;
}

export abstract class CreateImportUploadPort {
  abstract execute(input: {
    entityKey: string;
    tenantId?: string;
    contentType?: string;
    idempotencyKey?: string;
  }): Promise<{ storageObjectId: string; upload: PresignedUpload }>;
}

export abstract class CreateImportJobPort {
  abstract execute(input: {
    entityKey: string;
    storageObjectId: string;
    tenantId?: string;
    requestedBy?: string;
    traceId?: string;
    options?: ImportOptions;
  }): Promise<ImportJobRecord>;
}

export abstract class GetImportPreviewPort {
  abstract execute(input: { jobId: string; tenantId?: string }): Promise<{
    job: ImportJobRecord;
    sheets: string[];
    headerRow: number;
    sourceColumns: string[];
    suggestedMapping: ColumnMapping;
    sampleRows: Record<string, unknown>[];
  }>;
}

export abstract class UpdateImportMappingPort {
  abstract execute(input: {
    jobId: string;
    mapping: ColumnMapping;
    tenantId?: string;
    actor?: string;
  }): Promise<ImportJobRecord>;
}

export abstract class GetImportReportPort {
  abstract execute(input: {
    jobId: string;
    tenantId?: string;
    page: number;
    pageSize: number;
  }): Promise<{
    job: ImportJobRecord;
    errorRows: PageResult<ImportJobRowRecord>;
  }>;
}

export abstract class ExecuteImportJobPort {
  abstract execute(input: {
    jobId: string;
    tenantId?: string;
    actor?: string;
  }): Promise<ImportJobRecord>;
}

export abstract class CancelImportJobPort {
  abstract execute(input: {
    jobId: string;
    tenantId?: string;
    actor?: string;
  }): Promise<ImportJobRecord>;
}

export abstract class GetImportJobStatusPort {
  abstract execute(input: { jobId: string; tenantId?: string }): Promise<ImportJobRecord>;
}

export abstract class ListImportJobsPort {
  abstract execute(input: {
    tenantId?: string;
    status?: ImportJobRecord['status'];
    entityKey?: string;
    page: number;
    pageSize: number;
  }): Promise<PageResult<ImportJobRecord>>;
}

export abstract class ParseImportJobPort {
  abstract execute(jobId: string): Promise<void>;
}

export abstract class ValidateImportJobPort {
  abstract execute(jobId: string): Promise<void>;
}

export abstract class RunImportExecutionPort {
  abstract execute(jobId: string): Promise<void>;
}
