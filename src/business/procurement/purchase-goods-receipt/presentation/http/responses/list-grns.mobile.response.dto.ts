import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { GetGrnMobileResponseDto } from './get-grn.mobile.response.dto';

const listGrnsMobileSchema = z.object({
  items: z.array(z.any()),
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
  totalPages: z.number(),
});

export class ListGrnsMobileResponseDto extends createZodDto(listGrnsMobileSchema) {}
// @ts-expect-error deviceItem metadata
ListGrnsMobileResponseDto.deviceItem = GetGrnMobileResponseDto;
export type ListGrnsMobileResponse = InstanceType<typeof ListGrnsMobileResponseDto>;
