import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const getInvoiceWebSchema = z.object({
  id: z.string(),
  invoiceNo: z.string(),
  customerId: z.string(),
  status: z.string(),
  currency: z.string(),
  totalAmount: z.number(),
  postedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export class GetInvoiceWebResponseDto extends createZodDto(getInvoiceWebSchema) {}
export type GetInvoiceWebResponse = InstanceType<typeof GetInvoiceWebResponseDto>;
