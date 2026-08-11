import { z } from 'zod';

export const UpdateVendorRequestSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  email: z.email().optional(),
  phone: z.string().optional(),
  taxIdentifier: z.string().optional(),
});
