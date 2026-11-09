import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const settlePayableSchema = z.object({
  payableId: z.string().uuid('Payable ID must be a UUID'),
  paymentAmount: z.coerce.number().positive('Payment amount must be positive'),
  currency: z.string().min(1, 'Currency is required'),
  paymentDate: z.string().datetime('Invalid payment date'),
});

export class SettlePayableDto extends createZodDto(settlePayableSchema) {}
