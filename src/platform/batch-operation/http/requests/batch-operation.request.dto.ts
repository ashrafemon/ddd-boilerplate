import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const JOB_STATUSES = [
  'PENDING',
  'RUNNING',
  'COMPLETED',
  'COMPLETED_WITH_ERRORS',
  'FAILED',
  'CANCELLED',
] as const;

export const batchOperationSelectionSchema = z.object({
  aggregateType: z.string().min(1),
  operationCode: z.string().min(1),
  entityIds: z.array(z.string().min(1)).min(1),
  params: z.record(z.string(), z.unknown()).optional(),
});
export class SubmitBatchOperationDto extends createZodDto(batchOperationSelectionSchema) {}
export class ValidateBatchOperationDto extends createZodDto(batchOperationSelectionSchema) {}

export const batchOperationQuerySchema = z.object({
  status: z.enum(JOB_STATUSES).optional(),
  aggregateType: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).optional(),
});
export class BatchOperationQueryDto extends createZodDto(batchOperationQuerySchema) {}
