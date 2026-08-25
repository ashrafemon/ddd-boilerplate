import { createZodDto } from 'nestjs-zod';
import z from 'zod';

const createProductSchema = z.object({
  sku: z.string().min(1, 'Sku is required'),
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().optional(),
  unitPrice: z.coerce.number().min(0),
  currency: z.string(),
});

export class CreateProductDto extends createZodDto(createProductSchema) {}

const updateProductSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().optional(),
});

export class UpdateProductDto extends createZodDto(updateProductSchema) {}

const changePriceSchema = z.object({
  unitPrice: z.coerce.number().min(0),
  currency: z.string(),
});

export class ChangePriceDto extends createZodDto(changePriceSchema) {}

const productQuerySchema = z.object({
  page: z.coerce.number().optional(),
  pageSize: z.coerce.number().optional(),
});

export class ProductQueryDto extends createZodDto(productQuerySchema) {}
