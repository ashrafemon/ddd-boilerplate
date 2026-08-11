import { z } from 'zod';

export const PurchaseOrderActionRequestSchema = z.object({
  reason: z.string().min(1).max(500).optional(),
  approvedByUserId: z.string().optional(),
});
