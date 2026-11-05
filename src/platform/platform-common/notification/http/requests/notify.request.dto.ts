import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const notifySchema = z.object({
  notificationType: z.string().min(1),
  dedupKey: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).optional(),
  sourceEvent: z.string().optional(),
  priority: z.enum(['HIGH', 'NORMAL', 'LOW']).optional(),
});
export class NotifyDto extends createZodDto(notifySchema) {}
