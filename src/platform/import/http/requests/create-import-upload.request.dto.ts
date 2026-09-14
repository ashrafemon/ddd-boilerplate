import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createImportUploadSchema = z.object({
  entityKey: z.string().min(1),
  contentType: z
    .enum(['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv'])
    .optional(),
});
export class CreateUploadDto extends createZodDto(createImportUploadSchema) {}
