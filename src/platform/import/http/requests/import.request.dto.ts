import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createImportUploadSchema = z.object({
  entityKey: z.string().min(1),
  contentType: z.string().optional(),
});
export class CreateUploadDto extends createZodDto(createImportUploadSchema) {}

export const createImportJobSchema = z.object({
  entityKey: z.string().min(1),
  storageObjectId: z.string().min(1),
  options: z
    .object({
      mode: z.enum(['insert', 'upsert', 'skip-invalid']).optional(),
    })
    .catchall(z.unknown())
    .optional(),
});
export class CreateJobDto extends createZodDto(createImportJobSchema) {}

export const updateImportMappingSchema = z.object({
  mapping: z.record(z.string(), z.string()),
});
export class UpdateMappingDto extends createZodDto(updateImportMappingSchema) {}

export const importJobQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).optional(),
  status: z
    .enum([
      'PENDING_UPLOAD',
      'UPLOADED',
      'PARSING',
      'MAPPED',
      'VALIDATING',
      'VALIDATED',
      'EXECUTING',
      'COMPLETED',
      'COMPLETED_WITH_ERRORS',
      'FAILED',
      'CANCELLED',
    ])
    .optional(),
  entityKey: z.string().optional(),
});
export class ImportJobQueryDto extends createZodDto(importJobQuerySchema) {}
