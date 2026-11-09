import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const createJournalEntrySchema = z.object({
  entryNo: z.string().min(1, 'Entry number is required'),
  reference: z.string().optional().nullable(),
  postingDate: z.string().datetime('Invalid posting date'),
  entries: z
    .array(
      z.object({
        account: z.string().min(1, 'Account is required'),
        debit: z.number().nonnegative('Debit must be non-negative'),
        credit: z.number().nonnegative('Credit must be non-negative'),
        currency: z.string().min(1, 'Currency is required'),
      }),
    )
    .min(1, 'At least one entry line is required'),
});

export class CreateJournalEntryDto extends createZodDto(createJournalEntrySchema) {}
