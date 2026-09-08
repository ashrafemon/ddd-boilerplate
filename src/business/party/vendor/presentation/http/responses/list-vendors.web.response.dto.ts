import { z } from 'zod';
import { GetVendorWebResponseSchema } from './get-vendor.web.response.dto';

export const ListVendorsWebResponseSchema = z.object({
  items: z.array(GetVendorWebResponseSchema),
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
  totalPages: z.number(),
});

// @ts-expect-error ZodSchema.deviceItem augmentation
ListVendorsWebResponseSchema.deviceItem = GetVendorWebResponseSchema;

export type ListVendorsWebResponse = z.infer<typeof ListVendorsWebResponseSchema>;
