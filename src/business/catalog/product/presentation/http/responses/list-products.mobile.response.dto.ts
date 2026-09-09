import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { GetProductMobileResponseDto } from './get-product.mobile.response.dto';

const listProductsMobileSchema = z.object({
  items: z.array(z.any()),
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
  totalPages: z.number(),
});

export class ListProductsMobileResponseDto extends createZodDto(listProductsMobileSchema) {}
// @ts-expect-error deviceItem metadata
ListProductsMobileResponseDto.deviceItem = GetProductMobileResponseDto;
export type ListProductsMobileResponse = InstanceType<typeof ListProductsMobileResponseDto>;
