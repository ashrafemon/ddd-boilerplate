import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const REQUEST_STATUSES = [
  'PENDING',
  'RUNNING',
  'COMPLETED',
  'COMPLETED_WITH_ERRORS',
  'FAILED',
  'NO_RECIPIENTS',
] as const;

export const notificationQuerySchema = z.object({
  status: z.enum(REQUEST_STATUSES).optional(),
  notificationType: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).optional(),
});
export class NotificationQueryDto extends createZodDto(notificationQuerySchema) {}
