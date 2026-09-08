import { z } from 'zod';

export const CreateProductWebResponseSchema = z.object({
  id: z.string(),
  sku: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  status: z.string(),
  unitPrice: z.number(),
  currency: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type CreateProductWebResponse = z.infer<typeof CreateProductWebResponseSchema>;
