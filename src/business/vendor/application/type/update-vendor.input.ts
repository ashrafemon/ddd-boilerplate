export interface UpdateVendorInput {
  vendorId: string;
  name?: string;
  email?: string;
  phone?: string;
  taxIdentifier?: string;
}

export interface UpdateVendorOutput {
  vendorId: string;
  updatedAt: Date;
}
