import { z } from 'zod';

export const CreatePurchaseOrderWebResponseSchema = z.object({
  id: z.string(),
  orderNumber: z.string(),
  vendorId: z.string(),
  status: z.string(),
  currency: z.string(),
  subtotal: z.number(),
  total: z.number(),
  lines: z.array(z.never()),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type CreatePurchaseOrderWebResponse = z.infer<typeof CreatePurchaseOrderWebResponseSchema>;
