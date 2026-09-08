import { z } from 'zod';

export const GetProductWebResponseSchema = z.object({
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

export type GetProductWebResponse = z.infer<typeof GetProductWebResponseSchema>;
