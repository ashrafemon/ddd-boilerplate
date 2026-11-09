import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const SetGrnLineTrackingSchema = z.object({
  productId: z.string().min(1),
  entries: z.array(
    z.object({
      lotNo: z.string().optional(),
      serialNo: z.string().optional(),
      quantity: z.number().positive(),
      manufactureDate: z.coerce.date().optional(),
      expiryDate: z.coerce.date().optional(),
    }),
  ),
});

export class SetGrnLineTrackingDto extends createZodDto(SetGrnLineTrackingSchema) {}
