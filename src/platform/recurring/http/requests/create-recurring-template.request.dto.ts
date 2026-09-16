import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { jsonValueSchema } from '@shared-kernel/validation/json-value.schema';

const TRIGGER_TYPES = ['TIME', 'EVENT'] as const;
const FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const;
const PARTY_TYPES = ['CUSTOMER', 'VENDOR', 'EMPLOYEE'] as const;

function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const createRecurringTemplateSchema = z
  .object({
    templateNo: z.string().min(1),
    name: z.string().min(1),
    targetEntityType: z.string().min(1),
    targetEntityId: z.string().min(1).optional(),
    originDocumentType: z.string().min(1).optional(),
    originDocumentId: z.string().min(1).optional(),
    partyId: z.string().uuid().optional(),
    partyType: z.enum(PARTY_TYPES).optional(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/, 'currency must be a 3-letter ISO 4217 code')
      .optional(),
    triggerType: z.enum(TRIGGER_TYPES),
    eventName: z.string().min(1).optional(),
    frequency: z.enum(FREQUENCIES).optional(),
    interval: z.coerce.number().int().min(1).optional(),
    startDate: z.string().date().optional(),
    endDate: z.string().date().optional(),
    timeZone: z
      .string()
      .min(1)
      .refine(isValidTimeZone, 'timeZone must be a valid IANA time zone')
      .optional(),
    autoPost: z.boolean().optional(),
    autoEmail: z.boolean().optional(),
    autoApprove: z.boolean().optional(),
    headerOverrides: z.record(z.string(), jsonValueSchema).optional(),
    generationCondition: z.record(z.string(), jsonValueSchema).optional(),
    lines: z.array(jsonValueSchema).min(1).max(2000),
  })
  .superRefine((dto, ctx) => {
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
    if (dto.triggerType === 'EVENT' && (dto.frequency || dto.startDate || dto.endDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['triggerType'],
        message: 'TIME-only fields (frequency/interval/startDate) are not allowed for EVENT',
      });
    }
    if (dto.startDate && dto.endDate && dto.endDate < dto.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endDate'],
        message: 'endDate must not precede startDate',
      });
    }
  });

export class CreateRecurringTemplateDto extends createZodDto(createRecurringTemplateSchema) {}
