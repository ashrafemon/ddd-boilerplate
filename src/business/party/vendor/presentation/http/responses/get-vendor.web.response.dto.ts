import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const getVendorWebSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  status: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export class GetVendorWebResponseDto extends createZodDto(getVendorWebSchema) {}
export type GetVendorWebResponse = InstanceType<typeof GetVendorWebResponseDto>;
