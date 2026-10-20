import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { wireDate } from '@shared-kernel/types/wire-date';

const createPurchaseOrderWebSchema = z.object({
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

export class CreatePurchaseOrderWebResponseDto extends createZodDto(createPurchaseOrderWebSchema) {}
export type CreatePurchaseOrderWebResponse = InstanceType<typeof CreatePurchaseOrderWebResponseDto>;
