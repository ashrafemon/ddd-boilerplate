import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createPurchaseOrderSchema = z.object({
  vendorId: z.string().uuid(),
  currency: z.string().default('USD'),
});

export class CreatePurchaseOrderDto extends createZodDto(createPurchaseOrderSchema) {}
