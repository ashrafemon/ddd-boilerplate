import { z } from 'zod';

export const CreateGrnWebResponseSchema = z.object({
  id: z.string(),
  grnNumber: z.string(),
  purchaseOrderId: z.string(),
  vendorId: z.string(),
  status: z.string(),
  currency: z.string(),
  subtotal: z.number(),
  total: z.number(),
  lines: z.array(z.never()),
  receivedAt: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type CreateGrnWebResponse = z.infer<typeof CreateGrnWebResponseSchema>;
