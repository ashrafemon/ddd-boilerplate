import { z } from 'zod';

export const GetGrnMobileResponseSchema = z.object({
  id: z.string(),
  grnNumber: z.string(),
  status: z.string(),
  total: z.number(),
  lines: z.array(z.never()),
});

export type GetGrnMobileResponse = z.infer<typeof GetGrnMobileResponseSchema>;
