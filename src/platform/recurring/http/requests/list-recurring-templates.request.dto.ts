import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const recurringTemplateQuerySchema = z.object({
  status: z.enum(['ACTIVE', 'PAUSED', 'CANCELLED', 'COMPLETED']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).optional(),
});
export class RecurringTemplateQueryDto extends createZodDto(recurringTemplateQuerySchema) {}
