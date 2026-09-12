import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createProductSchema = z.object({
  sku: z.string().min(1, 'Sku is required'),
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().optional(),
  unitPrice: z.coerce.number().min(0),
  currency: z.string().default('USD'),
});

export class CreateProductDto extends createZodDto(createProductSchema) {}
