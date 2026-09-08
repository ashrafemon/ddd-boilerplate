import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const addGrnLineSchema = z.object({
  productId: z.string().uuid(),
  orderedQuantity: z.coerce.number().min(1),
  receivedQuantity: z.coerce.number().min(1),
  unitPrice: z.coerce.number().min(0),
});

export class AddGrnLineDto extends createZodDto(addGrnLineSchema) {}
