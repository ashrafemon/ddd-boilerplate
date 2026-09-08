import { z } from 'zod';

export const CreateVendorWebResponseSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  status: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type CreateVendorWebResponse = z.infer<typeof CreateVendorWebResponseSchema>;
