import { z } from 'zod';
import { GetProductMobileResponseSchema } from './get-product.mobile.response.dto';

export const ListProductsMobileResponseSchema = z.object({
  items: z.array(GetProductMobileResponseSchema),
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
  totalPages: z.number(),
});

// @ts-expect-error ZodSchema.deviceItem augmentation
ListProductsMobileResponseSchema.deviceItem = GetProductMobileResponseSchema;

export type ListProductsMobileResponse = z.infer<typeof ListProductsMobileResponseSchema>;
