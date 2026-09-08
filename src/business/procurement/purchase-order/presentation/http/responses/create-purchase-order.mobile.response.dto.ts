import { z } from 'zod';

export const CreatePurchaseOrderMobileResponseSchema = z.object({
  id: z.string(),
});

export type CreatePurchaseOrderMobileResponse = z.infer<
  typeof CreatePurchaseOrderMobileResponseSchema
>;
