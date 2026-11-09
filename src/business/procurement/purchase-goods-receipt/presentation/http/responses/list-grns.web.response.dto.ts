import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { GetGrnWebResponseDto } from './get-grn.web.response.dto';

const listGrnsWebSchema = z.object({
  items: z.array(z.any()),
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
  totalPages: z.number(),
});

export class ListGrnsWebResponseDto extends createZodDto(listGrnsWebSchema) {}
// @ts-expect-error deviceItem metadata
ListGrnsWebResponseDto.deviceItem = GetGrnWebResponseDto;
export type ListGrnsWebResponse = InstanceType<typeof ListGrnsWebResponseDto>;
