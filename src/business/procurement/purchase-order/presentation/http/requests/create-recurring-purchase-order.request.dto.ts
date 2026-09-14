import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { JsonObject, JsonValue } from '@shared-kernel/types/json-value.type';

/** Recursive JSON schema so stored conditions stay typed (no unknown). */
const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);
const jsonObjectSchema: z.ZodType<JsonObject> = z.record(z.string(), jsonValueSchema);

const TRIGGER_TYPES = ['TIME', 'EVENT'] as const;
const FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const;

const scheduleSchema = z.object({
  triggerType: z.enum(TRIGGER_TYPES),
  eventName: z.string().min(1).optional(),
  frequency: z.enum(FREQUENCIES).optional(),
  interval: z.coerce.number().int().min(1).optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  timeZone: z.string().min(1).optional(),
  autoPost: z.boolean().optional(),
  autoEmail: z.boolean().optional(),
  autoApprove: z.boolean().optional(),
  generationCondition: jsonObjectSchema.optional(),
});

function requireScheduleFields(dto: z.infer<typeof scheduleSchema>, ctx: z.RefinementCtx): void {
  if (dto.triggerType === 'EVENT' && !dto.eventName) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['eventName'],
      message: 'Required for EVENT',
    });
  }
  if (
    dto.triggerType === 'TIME' &&
    (!dto.frequency || dto.interval === undefined || !dto.startDate)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['frequency'],
      message: 'Required for TIME',
    });
  }
}

// Scenario: new data — no existing purchase order, vendor + lines supplied directly.
const createRecurringPurchaseOrderSchema = scheduleSchema
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

// Scenario: from an existing purchase order — vendor + lines are snapshotted server-side.
const createRecurringFromPurchaseOrderSchema = scheduleSchema
  .extend({
    name: z.string().min(1).optional(),
  })
  .superRefine(requireScheduleFields);

export class CreateRecurringFromPurchaseOrderDto extends createZodDto(
  createRecurringFromPurchaseOrderSchema,
) {}
