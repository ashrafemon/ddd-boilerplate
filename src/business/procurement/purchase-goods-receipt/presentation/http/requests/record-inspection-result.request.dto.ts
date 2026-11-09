import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const inspectionLineSchema = z.object({
  productId: z.string().uuid(),
  acceptedQuantity: z.coerce.number().int().min(0),
  rejectedQuantity: z.coerce.number().int().min(0),
});

/**
 * Accepted/rejected split (plan Phase 3.2): per line, `received = accepted +
 * rejected` is enforced by the aggregate invariant — the same physical
 * quantity can never carry both dispositions (GRN-01/02).
 */
export const recordInspectionResultSchema = z.object({
  lines: z.array(inspectionLineSchema).min(1),
});

export class RecordInspectionResultDto extends createZodDto(recordInspectionResultSchema) {}
