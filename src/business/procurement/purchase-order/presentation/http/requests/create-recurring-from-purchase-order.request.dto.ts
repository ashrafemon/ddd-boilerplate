import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  recurringPurchaseOrderScheduleSchema,
  requireScheduleFields,
} from './recurring-purchase-order.schema';

// Scenario: from an existing purchase order — vendor + lines are snapshotted server-side.
const createRecurringFromPurchaseOrderSchema = recurringPurchaseOrderScheduleSchema
  .extend({
    name: z.string().min(1).optional(),
  })
  .superRefine(requireScheduleFields);

export class CreateRecurringFromPurchaseOrderDto extends createZodDto(
  createRecurringFromPurchaseOrderSchema,
) {}
