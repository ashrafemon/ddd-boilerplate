import { z } from 'zod';

export const PurchaseOrderLineWebResponseSchema = z.object({
  productId: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  total: z.number(),
});

export const GetPurchaseOrderWebResponseSchema = z.object({
  id: z.string(),
  orderNumber: z.string(),
  vendorId: z.string(),
  status: z.string(),
  currency: z.string(),
  subtotal: z.number(),
  total: z.number(),
  lines: z.array(PurchaseOrderLineWebResponseSchema),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type GetPurchaseOrderWebResponse = z.infer<typeof GetPurchaseOrderWebResponseSchema>;
