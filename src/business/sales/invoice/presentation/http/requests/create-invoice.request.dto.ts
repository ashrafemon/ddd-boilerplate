import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createInvoiceSchema = z.object({
  customerId: z.string().uuid('customerId must be a uuid'),
  currency: z.string().length(3, 'currency must be a 3-letter ISO 4217 code').optional(),
  lines: z
    .array(
      z.object({
        description: z.string().min(1, 'Description is required'),
        quantity: z.number().positive(),
        unitPrice: z.number().min(0),
      }),
    )
    .min(1, 'At least one line is required'),
});
export class CreateInvoiceDto extends createZodDto(createInvoiceSchema) {}
