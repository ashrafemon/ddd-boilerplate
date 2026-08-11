import { VendorId } from '../../domain/value-objects/vendor-id.vo';

export interface VendorCommandPort {
  createVendor(input: CreateVendorInput): Promise<VendorId>;
  updateVendor(input: UpdateVendorInput): Promise<VendorId>;
  activateVendor(id: string): Promise<VendorId>;
  deactivateVendor(id: string): Promise<VendorId>;
  blockVendor(id: string): Promise<VendorId>;
}

export interface CreateVendorInput {
  code: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface UpdateVendorInput {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
}

export const VENDOR_COMMAND_PORT = Symbol('VENDOR_COMMAND_PORT');
