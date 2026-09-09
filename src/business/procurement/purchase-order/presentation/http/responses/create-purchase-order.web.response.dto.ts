import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const createPurchaseOrderWebSchema = z.object({
  id: z.string(),
  orderNumber: z.string(),
  vendorId: z.string(),
  status: z.string(),
  currency: z.string(),
  subtotal: z.number(),
  total: z.number(),
  lines: z.array(z.never()),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export class CreatePurchaseOrderWebResponseDto extends createZodDto(createPurchaseOrderWebSchema) {}
export type CreatePurchaseOrderWebResponse = InstanceType<typeof CreatePurchaseOrderWebResponseDto>;
