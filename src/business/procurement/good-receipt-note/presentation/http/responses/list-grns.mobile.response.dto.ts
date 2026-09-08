import { z } from 'zod';
import { GetGrnMobileResponseSchema } from './get-grn.mobile.response.dto';

export const ListGrnsMobileResponseSchema = z.object({
  items: z.array(GetGrnMobileResponseSchema),
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
  totalPages: z.number(),
});

// @ts-expect-error ZodSchema.deviceItem augmentation
ListGrnsMobileResponseSchema.deviceItem = GetGrnMobileResponseSchema;

export type ListGrnsMobileResponse = z.infer<typeof ListGrnsMobileResponseSchema>;
