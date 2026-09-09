import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const getPurchaseOrderMobileSchema = z.object({
  id: z.string(),
  orderNumber: z.string(),
  status: z.string(),
  total: z.number(),
  lines: z.array(z.never()),
});

export class GetPurchaseOrderMobileResponseDto extends createZodDto(getPurchaseOrderMobileSchema) {}
export type GetPurchaseOrderMobileResponse = InstanceType<typeof GetPurchaseOrderMobileResponseDto>;
