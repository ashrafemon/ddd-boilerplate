import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const createVendorMobileSchema = z.object({
  id: z.string(),
});

export class CreateVendorMobileResponseDto extends createZodDto(createVendorMobileSchema) {}
export type CreateVendorMobileResponse = InstanceType<typeof CreateVendorMobileResponseDto>;
