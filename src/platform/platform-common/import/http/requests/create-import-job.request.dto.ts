import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createImportJobSchema = z.object({
  entityKey: z.string().min(1),
  storageObjectId: z.string().min(1),
  options: z
    .object({
      mode: z.enum(['insert', 'upsert', 'skip-invalid']).optional(),
    })
    .catchall(z.unknown())
    .optional(),
});
export class CreateJobDto extends createZodDto(createImportJobSchema) {}
