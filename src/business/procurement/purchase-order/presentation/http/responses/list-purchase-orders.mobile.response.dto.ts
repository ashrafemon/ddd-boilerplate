import { z } from 'zod';
import { GetPurchaseOrderMobileResponseSchema } from './get-purchase-order.mobile.response.dto';

export const ListPurchaseOrdersMobileResponseSchema = z.object({
  items: z.array(GetPurchaseOrderMobileResponseSchema),
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
  totalPages: z.number(),
});

// @ts-expect-error ZodSchema.deviceItem augmentation
ListPurchaseOrdersMobileResponseSchema.deviceItem = GetPurchaseOrderMobileResponseSchema;

export type ListPurchaseOrdersMobileResponse = z.infer<
  typeof ListPurchaseOrdersMobileResponseSchema
>;
