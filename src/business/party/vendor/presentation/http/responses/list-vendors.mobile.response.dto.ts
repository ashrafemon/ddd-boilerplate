import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { GetVendorMobileResponseDto } from './get-vendor.mobile.response.dto';

const listVendorsMobileSchema = z.object({
  items: z.array(z.any()),
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
  totalPages: z.number(),
});

export class ListVendorsMobileResponseDto extends createZodDto(listVendorsMobileSchema) {}
// @ts-expect-error deviceItem metadata
ListVendorsMobileResponseDto.deviceItem = GetVendorMobileResponseDto;
export type ListVendorsMobileResponse = InstanceType<typeof ListVendorsMobileResponseDto>;
