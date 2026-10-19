import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Draft-header update (plan Phase 2.2). Every field optional; the use case
 * enforces DRAFT-only through the aggregate, so a non-draft PATCH is 422.
 */
export const updatePurchaseOrderSchema = z.object({
  orderDate: z.coerce.date().optional(),
  expectedDeliveryDate: z.coerce.date().optional(),
  externalReference: z.string().min(1).max(128).optional(),
});

export class UpdatePurchaseOrderDto extends createZodDto(updatePurchaseOrderSchema) {}
