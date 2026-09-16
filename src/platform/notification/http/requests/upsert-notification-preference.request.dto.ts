import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const upsertPreferenceSchema = z.object({
  recipientRef: z.string().min(1),
  category: z.string().min(1),
  channel: z.string().min(1),
  optedIn: z.boolean(),
  quietHoursStart: z.string().optional(),
  quietHoursEnd: z.string().optional(),
  timezone: z.string().optional(),
});
export class UpsertPreferenceDto extends createZodDto(upsertPreferenceSchema) {}
