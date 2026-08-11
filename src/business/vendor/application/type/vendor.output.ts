export interface GetVendorInput {
  vendorId: string;
}

export interface VendorAddressOutput {
  id: string;
  type: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postalCode: string | null;
  country: string;
}

export interface VendorOutput {
  id: string;
  tenantId: string;
  organizationId: string;
  code: string;
  name: string;
  status: string;
  email: string | null;
  phone: string | null;
  taxIdentifier: string | null;
  addresses: VendorAddressOutput[];
}
