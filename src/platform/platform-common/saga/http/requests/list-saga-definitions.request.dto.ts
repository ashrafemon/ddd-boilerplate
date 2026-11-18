import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const listSagaDefinitionsSchema = z.object({
  status: z.enum(['DRAFT', 'ACTIVE', 'INVALID', 'RETIRED']).optional(),
  sagaKey: z.string().optional(),
});

export class ListSagaDefinitionsDto extends createZodDto(listSagaDefinitionsSchema) {}
