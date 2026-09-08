import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const addLineSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1),
  unitPrice: z.coerce.number().min(0),
  currency: z.string().default('USD'),
});

export class AddLineDto extends createZodDto(addLineSchema) {}
