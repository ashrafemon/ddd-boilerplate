import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const JOB_STATUSES = ['PENDING', 'CLAIMED', 'RUNNING', 'FAILED', 'SUSPENDED', 'CANCELLED'] as const;

export const listScheduledJobsSchema = z.object({
  jobType: z.string().optional(),
  status: z.enum(JOB_STATUSES).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).optional(),
});
export class ListScheduledJobsDto extends createZodDto(listScheduledJobsSchema) {}
