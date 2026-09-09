import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { GetPurchaseOrderMobileResponseDto } from './get-purchase-order.mobile.response.dto';

const listPurchaseOrdersMobileSchema = z.object({
  items: z.array(z.any()),
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
  totalPages: z.number(),
});

export class ListPurchaseOrdersMobileResponseDto extends createZodDto(
  listPurchaseOrdersMobileSchema,
) {}
// @ts-expect-error deviceItem metadata
ListPurchaseOrdersMobileResponseDto.deviceItem = GetPurchaseOrderMobileResponseDto;
export type ListPurchaseOrdersMobileResponse = InstanceType<
  typeof ListPurchaseOrdersMobileResponseDto
>;
