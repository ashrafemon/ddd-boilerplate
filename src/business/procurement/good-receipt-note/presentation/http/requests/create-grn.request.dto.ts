import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const createGrnLineSchema = z.object({
  productId: z.string().uuid(),
  orderedQuantity: z.coerce.number().min(1),
  receivedQuantity: z.coerce.number().min(1),
  unitPrice: z.coerce.number().min(0),
});

export const createGrnSchema = z.object({
  purchaseOrderId: z.string().uuid(),
  vendorId: z.string().uuid(),
  currency: z.string().default('USD'),
  lines: z.array(createGrnLineSchema).min(1),
});

export class CreateGrnDto extends createZodDto(createGrnSchema) {}
