import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { GetProductWebResponseDto } from './get-product.web.response.dto';

const listProductsWebSchema = z.object({
  items: z.array(z.any()),
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
  totalPages: z.number(),
});

export class ListProductsWebResponseDto extends createZodDto(listProductsWebSchema) {}
// @ts-expect-error deviceItem metadata
ListProductsWebResponseDto.deviceItem = GetProductWebResponseDto;
export type ListProductsWebResponse = InstanceType<typeof ListProductsWebResponseDto>;
