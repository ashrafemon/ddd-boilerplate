import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const setSagaDefinitionStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'RETIRED']),
});

export class SetSagaDefinitionStatusDto extends createZodDto(setSagaDefinitionStatusSchema) {}
