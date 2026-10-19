import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Controlled amendment of an issued purchase order (spec §4
 * "AmendPurchaseOrder", PO-06).
 *
 * The reason is mandatory — an amendment without one is an unauditable
 * change. Line prices are keyed by product id and may only be changed on
 * lines that have not been received against yet.
 */
export const amendPurchaseOrderSchema = z.object({
  expectedDeliveryDate: z.coerce.date().optional(),
  lineUnitPrices: z.record(z.string().uuid(), z.coerce.number().min(0)).optional(),
  reason: z.string().min(3).max(500),
});

export class AmendPurchaseOrderDto extends createZodDto(amendPurchaseOrderSchema) {}
