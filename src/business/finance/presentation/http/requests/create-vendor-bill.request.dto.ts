import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const createVendorBillSchema = z.object({
  billNo: z.string().min(1, 'Bill number is required'),
  vendorId: z.string().uuid('Vendor ID must be a UUID'),
  amount: z.coerce.number().positive('Amount must be positive'),
  currency: z.string().min(1, 'Currency is required'),
  dueDate: z.string().datetime('Invalid due date'),
});

export class CreateVendorBillDto extends createZodDto(createVendorBillSchema) {}
