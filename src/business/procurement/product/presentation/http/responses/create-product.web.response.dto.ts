import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const createProductWebSchema = z.object({
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

export class CreateProductWebResponseDto extends createZodDto(createProductWebSchema) {}
export type CreateProductWebResponse = InstanceType<typeof CreateProductWebResponseDto>;
