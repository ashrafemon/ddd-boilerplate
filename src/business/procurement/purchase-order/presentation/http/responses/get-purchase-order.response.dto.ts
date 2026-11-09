import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { wireDate } from '@common/application/types/wire-date';

const purchaseOrderLineSchema = z.object({
  productId: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  total: z.number(),
});

const getPurchaseOrderSchema = z.object({
  id: z.string(),
  orderNumber: z.string(),
  vendorId: z.string(),
  status: z.string(),
  currency: z.string(),
  subtotal: z.number(),
  total: z.number(),
  lines: z.array(purchaseOrderLineSchema),
  createdAt: wireDate,
  updatedAt: wireDate,
});

export class GetPurchaseOrderResponseDto extends createZodDto(getPurchaseOrderSchema) {}
export type GetPurchaseOrderResponse = InstanceType<typeof GetPurchaseOrderResponseDto>;
