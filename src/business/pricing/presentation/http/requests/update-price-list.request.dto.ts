import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const UpdatePriceListSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
  currency: z.string().min(1).optional(),
  effectiveFrom: z.string().datetime().optional(),
  effectiveTo: z.string().datetime().optional().nullable(),
});

export class UpdatePriceListDto extends createZodDto(UpdatePriceListSchema) {}
