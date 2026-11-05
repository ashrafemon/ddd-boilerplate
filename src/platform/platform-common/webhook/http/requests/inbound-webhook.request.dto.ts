import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const inboundWebhookSchema = z.record(z.string(), z.unknown());
export class InboundWebhookDto extends createZodDto(inboundWebhookSchema) {}
