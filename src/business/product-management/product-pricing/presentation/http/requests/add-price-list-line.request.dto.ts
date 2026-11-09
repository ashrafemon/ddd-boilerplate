import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const AddPriceListLineSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  price: z.coerce.number().nonnegative('Price must be non-negative'),
  minQuantity: z.coerce.number().int().min(1, 'Minimum quantity must be >= 1'),
  maxQuantity: z.coerce.number().int().min(1).optional().nullable(),
});

export class AddPriceListLineDto extends createZodDto(AddPriceListLineSchema) {}
