import { z } from 'zod';
import { GetPurchaseOrderWebResponseSchema } from './get-purchase-order.web.response.dto';

export const ListPurchaseOrdersWebResponseSchema = z.object({
  items: z.array(GetPurchaseOrderWebResponseSchema),
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
  totalPages: z.number(),
});

// @ts-expect-error ZodSchema.deviceItem augmentation
ListPurchaseOrdersWebResponseSchema.deviceItem = GetPurchaseOrderWebResponseSchema;

export type ListPurchaseOrdersWebResponse = z.infer<typeof ListPurchaseOrdersWebResponseSchema>;
