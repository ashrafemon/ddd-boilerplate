import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const changePriceSchema = z.object({
  unitPrice: z.coerce.number().min(0),
  currency: z.string().default('USD'),
});

export class ChangePriceDto extends createZodDto(changePriceSchema) {}
