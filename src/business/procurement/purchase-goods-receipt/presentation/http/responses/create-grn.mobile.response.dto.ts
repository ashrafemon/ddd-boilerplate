import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const createGrnMobileSchema = z.object({
  id: z.string(),
});

export class CreateGrnMobileResponseDto extends createZodDto(createGrnMobileSchema) {}
export type CreateGrnMobileResponse = InstanceType<typeof CreateGrnMobileResponseDto>;
