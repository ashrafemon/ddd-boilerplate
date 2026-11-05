import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const importJobQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).optional(),
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
