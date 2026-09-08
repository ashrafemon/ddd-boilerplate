import { z } from 'zod';
import { GetProductWebResponseSchema } from './get-product.web.response.dto';

export const ListProductsWebResponseSchema = z.object({
  items: z.array(GetProductWebResponseSchema),
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
  totalPages: z.number(),
});

// @ts-expect-error ZodSchema.deviceItem augmentation
ListProductsWebResponseSchema.deviceItem = GetProductWebResponseSchema;

export type ListProductsWebResponse = z.infer<typeof ListProductsWebResponseSchema>;
