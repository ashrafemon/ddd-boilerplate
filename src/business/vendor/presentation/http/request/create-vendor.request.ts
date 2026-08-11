import { z } from 'zod';

export const CreateVendorAddressRequestSchema = z.object({
  type: z.enum(['BILLING', 'SHIPPING', 'REGISTERED']),
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().min(1),
});

export const CreateVendorContactRequestSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.email(),
  phone: z.string().optional(),
  role: z.string().optional(),
  isPrimary: z.boolean().optional(),
});

export const CreateVendorBankAccountRequestSchema = z.object({
  accountName: z.string().min(1),
  iban: z.string().min(8),
  bankName: z.string().optional(),
  currency: z.string().length(3),
  isDefault: z.boolean().optional(),
});

export const CreateVendorRequestSchema = z.object({
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(200),
  email: z.email().optional(),
  phone: z.string().optional(),
  taxIdentifier: z.string().optional(),
  addresses: z.array(CreateVendorAddressRequestSchema).optional(),
  contacts: z.array(CreateVendorContactRequestSchema).optional(),
  bankAccounts: z.array(CreateVendorBankAccountRequestSchema).optional(),
});
