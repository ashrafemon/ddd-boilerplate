import { z } from 'zod';

export const CreateProductRequestSchema = z.object({
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  sku: z.string().min(1).max(64),
  unit: z.string().min(1).max(8),
  priceCents: z.number().int().min(0),
  currency: z.string().length(3),
  isPurchasable: z.boolean().optional(),
  isSellable: z.boolean().optional(),
  categoryId: z.string().optional(),
});

export const UpdateProductRequestSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  sku: z.string().min(1).max(64).optional(),
  unit: z.string().min(1).max(8).optional(),
  priceCents: z.number().int().min(0).optional(),
  currency: z.string().length(3).optional(),
  isPurchasable: z.boolean().optional(),
  isSellable: z.boolean().optional(),
  categoryId: z.string().optional(),
});
