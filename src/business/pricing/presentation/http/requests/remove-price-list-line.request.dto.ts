import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const RemovePriceListLineSchema = z.object({});

export class RemovePriceListLineDto extends createZodDto(RemovePriceListLineSchema) {}
