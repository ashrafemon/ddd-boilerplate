import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const getProductWebSchema = z.object({
  id: z.string(),
  sku: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  status: z.string(),
  unitPrice: z.number(),
  currency: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export class GetProductWebResponseDto extends createZodDto(getProductWebSchema) {}
export type GetProductWebResponse = InstanceType<typeof GetProductWebResponseDto>;
