import { z } from 'zod';

export const CreateGrnMobileResponseSchema = z.object({
  id: z.string(),
});

export type CreateGrnMobileResponse = z.infer<typeof CreateGrnMobileResponseSchema>;
