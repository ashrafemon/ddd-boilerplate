import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const GetProductPriceSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
});

export class GetProductPriceDto extends createZodDto(GetProductPriceSchema) {}
