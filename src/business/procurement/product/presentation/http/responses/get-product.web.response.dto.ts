import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { wireDate } from '@shared-kernel/types/wire-date';

const getProductWebSchema = z.object({
  id: z.string(),
  sku: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  status: z.string(),
  unitPrice: z.number(),
  currency: z.string(),
  createdAt: wireDate,
  updatedAt: wireDate,
});

export class GetProductWebResponseDto extends createZodDto(getProductWebSchema) {}
export type GetProductWebResponse = InstanceType<typeof GetProductWebResponseDto>;
