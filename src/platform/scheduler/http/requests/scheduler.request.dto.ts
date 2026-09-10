import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const updateScheduledJobSchema = z.object({
  expectedVersion: z.coerce.number().int().min(0),
  cronExpression: z.string().min(1).optional(),
  nextRunAt: z.coerce.date().optional(),
  editedBy: z.string().optional(),
});
export class UpdateScheduledJobDto extends createZodDto(updateScheduledJobSchema) {}

export const listScheduledJobsSchema = z.object({
  jobType: z.string().optional(),
  status: z.string().optional(),
  limit: z.coerce.number().int().min(1).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export class ListScheduledJobsDto extends createZodDto(listScheduledJobsSchema) {}
