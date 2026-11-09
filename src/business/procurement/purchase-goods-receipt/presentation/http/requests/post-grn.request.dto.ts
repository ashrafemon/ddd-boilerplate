import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Client-supplied idempotency key (plan §1.4). Without it the POST falls back
 * to the GRN id as the key, so redelivered `POST /grn/:id/post` still replays
 * instead of double-registering the PO receipt.
 */
export const postGrnSchema = z.object({
  idempotencyKey: z.string().min(1).max(200).optional(),
});

export class PostGrnDto extends createZodDto(postGrnSchema) {}
