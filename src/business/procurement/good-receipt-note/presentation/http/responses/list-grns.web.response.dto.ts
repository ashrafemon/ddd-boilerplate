import { z } from 'zod';
import { GetGrnWebResponseSchema } from './get-grn.web.response.dto';

export const ListGrnsWebResponseSchema = z.object({
  items: z.array(GetGrnWebResponseSchema),
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
  totalPages: z.number(),
});

// @ts-expect-error ZodSchema.deviceItem augmentation
ListGrnsWebResponseSchema.deviceItem = GetGrnWebResponseSchema;

export type ListGrnsWebResponse = z.infer<typeof ListGrnsWebResponseSchema>;
