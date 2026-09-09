import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const grnLineWebSchema = z.object({
  productId: z.string(),
  orderedQuantity: z.number(),
  receivedQuantity: z.number(),
  unitPrice: z.number(),
  total: z.number(),
});

const getGrnWebSchema = z.object({
  id: z.string(),
  grnNumber: z.string(),
  purchaseOrderId: z.string(),
  vendorId: z.string(),
  status: z.string(),
  currency: z.string(),
  subtotal: z.number(),
  total: z.number(),
  lines: z.array(grnLineWebSchema),
  receivedAt: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export class GetGrnWebResponseDto extends createZodDto(getGrnWebSchema) {}
export type GetGrnWebResponse = InstanceType<typeof GetGrnWebResponseDto>;
