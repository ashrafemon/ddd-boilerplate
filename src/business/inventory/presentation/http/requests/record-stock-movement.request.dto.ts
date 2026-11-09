import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const recordStockMovementSchema = z.object({
  grnLineId: z.string().min(1, 'GRN line ID is required'),
  productId: z.string().uuid('Product ID must be a UUID'),
  quantity: z.coerce.number().int().min(1, 'Quantity must be >= 1'),
  movementType: z.enum(['GOODS_RECEIPT', 'GOODS_RECEIPT_REVERSAL']),
  sourceDocumentId: z.string().min(1, 'Source document ID is required'),
  sourceDocumentType: z.string().min(1, 'Source document type is required'),
  actorId: z.string().uuid().optional().nullable(),
  effectiveDate: z.string().datetime().optional().nullable(),
});

export class RecordStockMovementDto extends createZodDto(recordStockMovementSchema) {}
