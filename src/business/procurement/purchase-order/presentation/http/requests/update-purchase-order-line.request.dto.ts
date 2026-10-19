import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Draft line rewrite (plan Phase 2.2): `setLine` semantics — quantity and
 * price are REPLACED (never summed), DRAFT-only via the aggregate.
 */
export const updatePurchaseOrderLineSchema = z.object({
  quantity: z.coerce.number().int().min(1),
  unitPrice: z.coerce.number().min(0),
  // Optional: falls back to the company default currency (CompanyConfigPort).
  currency: z.string().optional(),
});

export class UpdatePurchaseOrderLineDto extends createZodDto(updatePurchaseOrderLineSchema) {}
