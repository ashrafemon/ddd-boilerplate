import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const updateWebhookSubscriptionSchema = z.object({
  url: z.string().url().optional(),
  secret: z.string().min(16).optional(),
  eventTypes: z.array(z.string().min(1)).min(1).optional(),
  status: z.enum(['ACTIVE', 'PAUSED', 'DISABLED']).optional(),
  description: z.string().max(500).nullable().optional(),
});
export class UpdateWebhookSubscriptionDto extends createZodDto(updateWebhookSubscriptionSchema) {}
