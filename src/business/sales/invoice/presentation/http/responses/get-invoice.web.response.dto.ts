import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { wireDate } from '@shared-kernel/types/wire-date';

const getInvoiceWebSchema = z.object({
  id: z.string(),
  invoiceNo: z.string(),
  customerId: z.string(),
  status: z.string(),
  currency: z.string(),
  totalAmount: z.number(),
  postedAt: wireDate.nullable(),
  createdAt: wireDate,
  updatedAt: wireDate,
});
export class GetInvoiceWebResponseDto extends createZodDto(getInvoiceWebSchema) {}
export type GetInvoiceWebResponse = InstanceType<typeof GetInvoiceWebResponseDto>;
