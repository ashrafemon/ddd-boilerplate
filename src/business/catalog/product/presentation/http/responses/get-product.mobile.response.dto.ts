import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const getProductMobileSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  unitPrice: z.number(),
  currency: z.string(),
});

export class GetProductMobileResponseDto extends createZodDto(getProductMobileSchema) {}
export type GetProductMobileResponse = InstanceType<typeof GetProductMobileResponseDto>;
