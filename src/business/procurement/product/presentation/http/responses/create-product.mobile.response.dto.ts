import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const createProductMobileSchema = z.object({
  id: z.string(),
});

export class CreateProductMobileResponseDto extends createZodDto(createProductMobileSchema) {}
export type CreateProductMobileResponse = InstanceType<typeof CreateProductMobileResponseDto>;
