import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const idSchema = z.object({
  id: z.string(),
});

export class IdResponseDto extends createZodDto(idSchema) {}
export type IdResponse = InstanceType<typeof IdResponseDto>;
