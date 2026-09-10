import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const TRIGGER_TYPES = ['TIME', 'EVENT'] as const;
const FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const;
const PARTY_TYPES = ['CUSTOMER', 'VENDOR', 'EMPLOYEE'] as const;

const baseSchema = z
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
    timeZone: z.string().min(1).optional(),
    autoPost: z.boolean().optional(),
    autoEmail: z.boolean().optional(),
    autoApprove: z.boolean().optional(),
    headerOverrides: z.record(z.string(), z.unknown()).optional(),
    generationCondition: z.record(z.string(), z.unknown()).optional(),
    lines: z.array(z.unknown()).min(1),
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
  });

export class CreateRecurringTemplateDto extends createZodDto(baseSchema) {}

export const recurringTemplateQuerySchema = z.object({
  status: z.enum(['ACTIVE', 'PAUSED', 'CANCELLED', 'COMPLETED']).optional(),
});
export class RecurringTemplateQueryDto extends createZodDto(recurringTemplateQuerySchema) {}
