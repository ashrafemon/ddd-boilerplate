import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const deliveryWebhookSchema = z.record(z.string(), z.unknown());
export class DeliveryWebhookDto extends createZodDto(deliveryWebhookSchema) {}
