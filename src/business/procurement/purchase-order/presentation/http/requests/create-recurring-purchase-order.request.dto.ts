import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  recurringPurchaseOrderScheduleSchema,
  requireScheduleFields,
} from './recurring-purchase-order.schema';

// Scenario: new data — no existing purchase order, vendor + lines supplied directly.
const createRecurringPurchaseOrderSchema = recurringPurchaseOrderScheduleSchema
  .extend({
    name: z.string().min(1),
    vendorId: z.string().uuid(),
    currency: z.string().default('USD'),
    lines: z
      .array(
        z.object({
          productId: z.string().uuid(),
          quantity: z.coerce.number().int().min(1),
          unitPrice: z.coerce.number().min(0),
        }),
      )
      .min(1),
  })
  .superRefine(requireScheduleFields);

export class CreateRecurringPurchaseOrderDto extends createZodDto(
  createRecurringPurchaseOrderSchema,
) {}
