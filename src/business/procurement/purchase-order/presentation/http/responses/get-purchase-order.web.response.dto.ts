import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const purchaseOrderLineWebSchema = z.object({
  productId: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  total: z.number(),
});

const getPurchaseOrderWebSchema = z.object({
  id: z.string(),
  orderNumber: z.string(),
  vendorId: z.string(),
  status: z.string(),
  currency: z.string(),
  subtotal: z.number(),
  total: z.number(),
  lines: z.array(purchaseOrderLineWebSchema),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export class GetPurchaseOrderWebResponseDto extends createZodDto(getPurchaseOrderWebSchema) {}
export type GetPurchaseOrderWebResponse = InstanceType<typeof GetPurchaseOrderWebResponseDto>;
