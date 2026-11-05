import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const webhookSubscriptionQuerySchema = z.object({
  status: z.enum(['ACTIVE', 'PAUSED', 'DISABLED']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).optional(),
});
export class WebhookSubscriptionQueryDto extends createZodDto(webhookSubscriptionQuerySchema) {}
