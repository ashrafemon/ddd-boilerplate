import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createWebhookSubscriptionSchema = z.object({
  url: z.string().url(),
  secret: z.string().min(16),
  eventTypes: z.array(z.string().min(1)).min(1),
  description: z.string().max(500).optional(),
});
export class CreateWebhookSubscriptionDto extends createZodDto(createWebhookSubscriptionSchema) {}
