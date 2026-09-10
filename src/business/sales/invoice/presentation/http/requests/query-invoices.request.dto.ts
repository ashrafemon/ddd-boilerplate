import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const queryInvoicesSchema = z.object({
  page: z.coerce.number().optional(),
  pageSize: z.coerce.number().optional(),
});
export class InvoiceQueryDto extends createZodDto(queryInvoicesSchema) {}
