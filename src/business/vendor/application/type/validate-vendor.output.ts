export interface ValidateVendorInput {
  vendorId: string;
}

export interface ValidateVendorOutput {
  vendorId: string;
  code: string;
  name: string;
  status: string;
  isActive: boolean;
}
