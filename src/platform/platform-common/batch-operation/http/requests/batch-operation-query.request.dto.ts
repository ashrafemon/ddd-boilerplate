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

export const batchOperationQuerySchema = z.object({
  status: z.enum(JOB_STATUSES).optional(),
  aggregateType: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).optional(),
});
export class BatchOperationQueryDto extends createZodDto(batchOperationQuerySchema) {}
