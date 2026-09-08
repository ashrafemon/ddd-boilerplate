import { z } from 'zod';

export const CreateVendorMobileResponseSchema = z.object({
  id: z.string(),
});

export type CreateVendorMobileResponse = z.infer<typeof CreateVendorMobileResponseSchema>;
