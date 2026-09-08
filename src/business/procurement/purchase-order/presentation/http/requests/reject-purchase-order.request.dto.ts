import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const rejectPurchaseOrderSchema = z.object({
  reason: z.string().min(1, 'Reason is required'),
});

export class RejectPurchaseOrderDto extends createZodDto(rejectPurchaseOrderSchema) {}
