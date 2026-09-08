import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const queryGrnsSchema = z.object({
  page: z.coerce.number().optional(),
  pageSize: z.coerce.number().optional(),
});

export class GrnQueryDto extends createZodDto(queryGrnsSchema) {}
