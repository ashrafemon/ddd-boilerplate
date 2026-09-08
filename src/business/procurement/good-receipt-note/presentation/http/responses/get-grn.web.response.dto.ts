import { z } from 'zod';

export const GrnLineWebResponseSchema = z.object({
  productId: z.string(),
  orderedQuantity: z.number(),
  receivedQuantity: z.number(),
  unitPrice: z.number(),
  total: z.number(),
});

export const GetGrnWebResponseSchema = z.object({
  id: z.string(),
  grnNumber: z.string(),
  purchaseOrderId: z.string(),
  vendorId: z.string(),
  status: z.string(),
  currency: z.string(),
  subtotal: z.number(),
  total: z.number(),
  lines: z.array(GrnLineWebResponseSchema),
  receivedAt: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type GetGrnWebResponse = z.infer<typeof GetGrnWebResponseSchema>;
