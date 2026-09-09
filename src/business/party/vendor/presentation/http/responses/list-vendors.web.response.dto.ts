import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { GetVendorWebResponseDto } from './get-vendor.web.response.dto';

const listVendorsWebSchema = z.object({
  items: z.array(z.any()),
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
  totalPages: z.number(),
});

export class ListVendorsWebResponseDto extends createZodDto(listVendorsWebSchema) {}
// @ts-expect-error deviceItem metadata
ListVendorsWebResponseDto.deviceItem = GetVendorWebResponseDto;
export type ListVendorsWebResponse = InstanceType<typeof ListVendorsWebResponseDto>;
