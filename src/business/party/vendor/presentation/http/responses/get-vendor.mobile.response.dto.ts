import { z } from 'zod';

export const GetVendorMobileResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
});

export type GetVendorMobileResponse = z.infer<typeof GetVendorMobileResponseSchema>;
