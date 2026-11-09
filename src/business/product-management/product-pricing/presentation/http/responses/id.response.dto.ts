import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const IdSchema = z.object({
  id: z.string().min(1, 'ID is required'),
});

export class IdResponse extends createZodDto(IdSchema) {}
