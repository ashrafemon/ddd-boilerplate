import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { wireDate } from '@shared-kernel/types/wire-date';

const createGrnWebSchema = z.object({
  id: z.string(),
  grnNumber: z.string(),
  purchaseOrderId: z.string(),
  vendorId: z.string(),
  status: z.string(),
  currency: z.string(),
  subtotal: z.number(),
  total: z.number(),
  lines: z.array(z.never()),
  receivedAt: wireDate.nullable(),
  createdAt: wireDate,
  updatedAt: wireDate,
});

export class CreateGrnWebResponseDto extends createZodDto(createGrnWebSchema) {}
export type CreateGrnWebResponse = InstanceType<typeof CreateGrnWebResponseDto>;
