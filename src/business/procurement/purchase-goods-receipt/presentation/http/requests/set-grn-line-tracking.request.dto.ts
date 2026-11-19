import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { requestDate } from '@common/application/types/wire-date';

export const SetGrnLineTrackingSchema = z.object({
  productId: z.string().min(1),
  entries: z.array(
    z.object({
      lotNo: z.string().optional(),
      serialNo: z.string().optional(),
      quantity: z.number().positive(),
      manufactureDate: requestDate.optional(),
      expiryDate: requestDate.optional(),
    }),
  ),
});

export class SetGrnLineTrackingDto extends createZodDto(SetGrnLineTrackingSchema) {}
