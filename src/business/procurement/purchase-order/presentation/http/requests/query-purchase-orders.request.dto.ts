import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const queryPurchaseOrdersSchema = z.object({
  page: z.coerce.number().optional(),
  pageSize: z.coerce.number().optional(),
});

export class PurchaseOrderQueryDto extends createZodDto(queryPurchaseOrdersSchema) {}
