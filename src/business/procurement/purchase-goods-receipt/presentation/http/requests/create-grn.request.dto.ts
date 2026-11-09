import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const createGrnLineSchema = z.object({
  productId: z.string().uuid(),
  orderedQuantity: z.coerce.number().min(1),
  receivedQuantity: z.coerce.number().min(1),
  unitPrice: z.coerce.number().min(0),
});

export const createGrnSchema = z.object({
  purchaseOrderId: z.string().uuid(),
  vendorId: z.string().uuid(),
  currency: z.string().default('USD'),
  // Optional replay guard (plan §1.4, scope `grn.create`): when present, a
  // duplicate create returns the original GRN id instead of a second document.
  idempotencyKey: z.string().min(1).max(200).optional(),
  lines: z.array(createGrnLineSchema).min(1),
});

export class CreateGrnDto extends createZodDto(createGrnSchema) {}
