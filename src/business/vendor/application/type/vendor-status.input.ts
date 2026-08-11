export interface ActivateVendorInput {
  vendorId: string;
}

export interface ActivateVendorOutput {
  vendorId: string;
  status: 'ACTIVE';
}

export interface DeactivateVendorInput {
  vendorId: string;
}

export interface DeactivateVendorOutput {
  vendorId: string;
  status: 'INACTIVE';
}
