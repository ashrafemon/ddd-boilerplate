import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const createPurchaseOrderMobileSchema = z.object({
  id: z.string(),
});

export class CreatePurchaseOrderMobileResponseDto extends createZodDto(
  createPurchaseOrderMobileSchema,
) {}
export type CreatePurchaseOrderMobileResponse = InstanceType<
  typeof CreatePurchaseOrderMobileResponseDto
>;
