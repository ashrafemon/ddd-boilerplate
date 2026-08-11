export interface CreateVendorAddressInput {
  type: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
}

export interface CreateVendorContactInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role?: string;
  isPrimary?: boolean;
}

export interface CreateVendorBankAccountInput {
  accountName: string;
  iban: string;
  bankName?: string;
  currency: string;
  isDefault?: boolean;
}

export interface CreateVendorInput {
  code: string;
  name: string;
  email?: string;
  phone?: string;
  taxIdentifier?: string;
  addresses?: CreateVendorAddressInput[];
  contacts?: CreateVendorContactInput[];
  bankAccounts?: CreateVendorBankAccountInput[];
}

export interface CreateVendorOutput {
  vendorId: string;
}
