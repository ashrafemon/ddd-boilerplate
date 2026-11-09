import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const updateProductSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().optional(),
});

export class UpdateProductDto extends createZodDto(updateProductSchema) {}
