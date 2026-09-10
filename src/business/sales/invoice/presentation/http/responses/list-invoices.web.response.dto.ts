import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { GetInvoiceWebResponseDto } from './get-invoice.web.response.dto';

const listInvoicesWebSchema = z.object({
  items: z.array(z.any()),
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
  totalPages: z.number(),
});
export class ListInvoicesWebResponseDto extends createZodDto(listInvoicesWebSchema) {}
// @ts-expect-error deviceItem metadata
ListInvoicesWebResponseDto.deviceItem = GetInvoiceWebResponseDto;
export type ListInvoicesWebResponse = InstanceType<typeof ListInvoicesWebResponseDto>;
