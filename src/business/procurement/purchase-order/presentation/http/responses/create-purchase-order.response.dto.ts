import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { wireDate } from '@common/application/types/wire-date';

const createPurchaseOrderSchema = z.object({
  id: z.string(),
  orderNumber: z.string(),
  vendorId: z.string(),
  status: z.string(),
  currency: z.string(),
  subtotal: z.number(),
  total: z.number(),
  lines: z.array(z.never()),
  createdAt: wireDate,
  updatedAt: wireDate,
});

export class CreatePurchaseOrderResponseDto extends createZodDto(createPurchaseOrderSchema) {}
export type CreatePurchaseOrderResponse = InstanceType<typeof CreatePurchaseOrderResponseDto>;
