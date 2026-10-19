import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Client-supplied idempotency key (plan §1.4). Without it the reverse falls
 * back to `grn.reverse:<id>`, so redelivery can never mint a second
 * compensation document for the same original (Phase 4.1).
 */
export const reverseGrnSchema = z.object({
  idempotencyKey: z.string().min(1).max(200).optional(),
});

export class ReverseGrnDto extends createZodDto(reverseGrnSchema) {}
