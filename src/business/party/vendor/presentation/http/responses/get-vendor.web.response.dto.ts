import { z } from 'zod';

export const GetVendorWebResponseSchema = z.object({
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

export type GetVendorWebResponse = z.infer<typeof GetVendorWebResponseSchema>;
