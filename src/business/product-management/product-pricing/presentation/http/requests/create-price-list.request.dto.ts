import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CreatePriceListSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Code is required'),
  currency: z.string().min(1, 'Currency is required'),
  effectiveFrom: z.string().datetime('Invalid effective from date'),
  effectiveTo: z.string().datetime().optional().nullable(),
});

export class CreatePriceListDto extends createZodDto(CreatePriceListSchema) {}
