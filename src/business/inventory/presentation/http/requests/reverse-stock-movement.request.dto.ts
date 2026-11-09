import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const reverseStockMovementSchema = z.object({
  reason: z.string().optional().nullable(),
});

export class ReverseStockMovementDto extends createZodDto(reverseStockMovementSchema) {}
