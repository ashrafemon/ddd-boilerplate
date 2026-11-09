import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const ActivatePriceListSchema = z.object({});

export class ActivatePriceListDto extends createZodDto(ActivatePriceListSchema) {}
