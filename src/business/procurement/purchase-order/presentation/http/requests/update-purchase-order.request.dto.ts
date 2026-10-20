import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { requestDate } from '@shared-kernel/types/wire-date';

/**
 * Draft-header update (plan Phase 2.2). Every field optional; the use case
 * enforces DRAFT-only through the aggregate, so a non-draft PATCH is 422.
 */
export const updatePurchaseOrderSchema = z.object({
  orderDate: requestDate.optional(),
  expectedDeliveryDate: requestDate.optional(),
  externalReference: z.string().min(1).max(128).optional(),
});

export class UpdatePurchaseOrderDto extends createZodDto(updatePurchaseOrderSchema) {}
