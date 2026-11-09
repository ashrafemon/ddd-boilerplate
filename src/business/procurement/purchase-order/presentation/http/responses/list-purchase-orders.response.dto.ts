import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { GetPurchaseOrderResponseDto } from './get-purchase-order.response.dto';

const listPurchaseOrdersSchema = z.object({
  items: z.array(z.any()),
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
  totalPages: z.number(),
});

export class ListPurchaseOrdersResponseDto extends createZodDto(listPurchaseOrdersSchema) {}
// @ts-expect-error deviceItem metadata
ListPurchaseOrdersResponseDto.deviceItem = GetPurchaseOrderResponseDto;
export type ListPurchaseOrdersResponse = InstanceType<typeof ListPurchaseOrdersResponseDto>;
