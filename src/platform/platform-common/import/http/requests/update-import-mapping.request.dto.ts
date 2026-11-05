import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** Reserved mapped-payload keys that would otherwise overwrite row identity. */
const FORBIDDEN_TARGETS = ['rowNumber', 'status', 'errors'];

export const updateImportMappingSchema = z.object({
  mapping: z
    .record(z.string().min(1), z.string().min(1))
    .refine(
      mapping => Object.values(mapping).every(target => !FORBIDDEN_TARGETS.includes(target)),
      { message: `mapping targets must not be one of: ${FORBIDDEN_TARGETS.join(', ')}` },
    ),
});
export class UpdateMappingDto extends createZodDto(updateImportMappingSchema) {}
