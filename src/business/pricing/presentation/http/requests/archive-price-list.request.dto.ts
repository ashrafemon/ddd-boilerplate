import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const ArchivePriceListSchema = z.object({});

export class ArchivePriceListDto extends createZodDto(ArchivePriceListSchema) {}
