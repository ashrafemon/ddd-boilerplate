import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const getVendorMobileSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
});

export class GetVendorMobileResponseDto extends createZodDto(getVendorMobileSchema) {}
export type GetVendorMobileResponse = InstanceType<typeof GetVendorMobileResponseDto>;
