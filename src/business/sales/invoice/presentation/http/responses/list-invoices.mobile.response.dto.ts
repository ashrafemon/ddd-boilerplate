import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { GetInvoiceMobileResponseDto } from './get-invoice.mobile.response.dto';

const listInvoicesMobileSchema = z.object({
  items: z.array(z.any()),
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
  totalPages: z.number(),
});
export class ListInvoicesMobileResponseDto extends createZodDto(listInvoicesMobileSchema) {}
// @ts-expect-error deviceItem metadata
ListInvoicesMobileResponseDto.deviceItem = GetInvoiceMobileResponseDto;
export type ListInvoicesMobileResponse = InstanceType<typeof ListInvoicesMobileResponseDto>;
