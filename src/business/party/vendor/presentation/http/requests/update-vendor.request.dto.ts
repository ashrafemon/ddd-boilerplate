import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const updateVendorSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

export class UpdateVendorDto extends createZodDto(updateVendorSchema) {}
