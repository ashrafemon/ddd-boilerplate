import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const getGrnMobileSchema = z.object({
  id: z.string(),
  grnNumber: z.string(),
  status: z.string(),
  total: z.number(),
  lines: z.array(z.never()),
});

export class GetGrnMobileResponseDto extends createZodDto(getGrnMobileSchema) {}
export type GetGrnMobileResponse = InstanceType<typeof GetGrnMobileResponseDto>;
