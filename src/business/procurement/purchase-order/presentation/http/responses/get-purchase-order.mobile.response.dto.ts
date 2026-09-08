import { z } from 'zod';

export const GetPurchaseOrderMobileResponseSchema = z.object({
  id: z.string(),
  orderNumber: z.string(),
  status: z.string(),
  total: z.number(),
  lines: z.array(z.never()),
});

export type GetPurchaseOrderMobileResponse = z.infer<typeof GetPurchaseOrderMobileResponseSchema>;
