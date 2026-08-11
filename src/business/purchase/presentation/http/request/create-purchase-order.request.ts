import { z } from 'zod';

export const CreatePurchaseOrderLineRequestSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().positive(),
  unitPriceCents: z.number().int().min(0).optional(),
  taxRateBps: z.number().int().min(0).max(10000).optional(),
  description: z.string().max(500).optional(),
});

export const CreatePurchaseOrderRequestSchema = z.object({
  vendorId: z.string().min(1),
  currency: z.string().length(3).optional(),
  notes: z.string().max(1000).optional(),
  lines: z.array(CreatePurchaseOrderLineRequestSchema).min(1),
});

export const UpdatePurchaseOrderRequestSchema = z.object({
  vendorId: z.string().min(1).optional(),
  currency: z.string().length(3).optional(),
  notes: z.string().max(1000).optional(),
  lines: z.array(CreatePurchaseOrderLineRequestSchema).optional(),
});
