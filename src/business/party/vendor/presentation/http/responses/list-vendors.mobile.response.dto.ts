import { z } from 'zod';
import { GetVendorMobileResponseSchema } from './get-vendor.mobile.response.dto';

export const ListVendorsMobileResponseSchema = z.object({
  items: z.array(GetVendorMobileResponseSchema),
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
  totalPages: z.number(),
});

// @ts-expect-error ZodSchema.deviceItem augmentation
ListVendorsMobileResponseSchema.deviceItem = GetVendorMobileResponseSchema;

export type ListVendorsMobileResponse = z.infer<typeof ListVendorsMobileResponseSchema>;
