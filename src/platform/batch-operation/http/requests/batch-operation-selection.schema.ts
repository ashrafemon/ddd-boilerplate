import { z } from 'zod';

/** Selection shape shared by submit and validate (same payload, different endpoints). */
export const batchOperationSelectionSchema = z.object({
  aggregateType: z.string().min(1),
  operationCode: z.string().min(1),
  entityIds: z.array(z.string().min(1)).min(1).max(5000),
  params: z.record(z.string(), z.unknown()).optional(),
});
