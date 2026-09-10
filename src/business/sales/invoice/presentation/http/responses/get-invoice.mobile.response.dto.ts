import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const getInvoiceMobileSchema = z.object({
  id: z.string(),
  invoiceNo: z.string(),
  status: z.string(),
  totalAmount: z.number(),
});
export class GetInvoiceMobileResponseDto extends createZodDto(getInvoiceMobileSchema) {}
export type GetInvoiceMobileResponse = InstanceType<typeof GetInvoiceMobileResponseDto>;
