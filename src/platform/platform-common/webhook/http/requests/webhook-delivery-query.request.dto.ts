import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const webhookDeliveryQuerySchema = z.object({
  status: z.enum(['PENDING', 'DELIVERING', 'DELIVERED', 'DEAD_LETTER']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).optional(),
});
export class WebhookDeliveryQueryDto extends createZodDto(webhookDeliveryQuerySchema) {}
