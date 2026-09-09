import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

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
  receivedAt: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export class CreateGrnWebResponseDto extends createZodDto(createGrnWebSchema) {}
export type CreateGrnWebResponse = InstanceType<typeof CreateGrnWebResponseDto>;
