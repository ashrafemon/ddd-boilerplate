import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const DeactivatePriceListSchema = z.object({});

export class DeactivatePriceListDto extends createZodDto(DeactivatePriceListSchema) {}
