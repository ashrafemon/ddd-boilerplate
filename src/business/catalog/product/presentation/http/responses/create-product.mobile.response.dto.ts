import { z } from 'zod';

export const CreateProductMobileResponseSchema = z.object({
  id: z.string(),
});

export type CreateProductMobileResponse = z.infer<typeof CreateProductMobileResponseSchema>;
