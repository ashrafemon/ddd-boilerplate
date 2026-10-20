import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { wireDate } from '@shared-kernel/types/wire-date';

const getVendorWebSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  status: z.string(),
  createdAt: wireDate,
  updatedAt: wireDate,
});

export class GetVendorWebResponseDto extends createZodDto(getVendorWebSchema) {}
export type GetVendorWebResponse = InstanceType<typeof GetVendorWebResponseDto>;
