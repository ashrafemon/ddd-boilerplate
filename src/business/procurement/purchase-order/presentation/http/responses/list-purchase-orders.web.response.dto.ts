import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { GetPurchaseOrderWebResponseDto } from './get-purchase-order.web.response.dto';

const listPurchaseOrdersWebSchema = z.object({
  items: z.array(z.any()),
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
  totalPages: z.number(),
});

export class ListPurchaseOrdersWebResponseDto extends createZodDto(listPurchaseOrdersWebSchema) {}
// @ts-expect-error deviceItem metadata
ListPurchaseOrdersWebResponseDto.deviceItem = GetPurchaseOrderWebResponseDto;
export type ListPurchaseOrdersWebResponse = InstanceType<typeof ListPurchaseOrdersWebResponseDto>;
