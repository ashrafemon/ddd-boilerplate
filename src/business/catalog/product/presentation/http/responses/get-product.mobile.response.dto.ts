import { z } from 'zod';

export const GetProductMobileResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  unitPrice: z.number(),
  currency: z.string(),
});

export type GetProductMobileResponse = z.infer<typeof GetProductMobileResponseSchema>;
