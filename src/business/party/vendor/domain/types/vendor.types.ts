import { VendorEmail } from '../value-objects/vendor.vos';
import { VendorName } from '../value-objects/vendor.vos';
import { VendorCode } from '../value-objects/vendor.vos';
import { VendorStatus } from './vendor.enum';
export { VendorStatus } from './vendor.enum';

export interface VendorProps {
  code: VendorCode;
  name: VendorName;
  email: VendorEmail | null;
  phone: string | null;
  address: string | null;
  status: VendorStatus;
  createdAt: Date;
  updatedAt: Date;
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
  code?: string;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
}

export type VendorStatusAction = 'activate' | 'deactivate' | 'block';

export interface VendorStatusInput {
  id: string;
  action: VendorStatusAction;
}

export interface VendorState {
  status: VendorStatus;
}

export interface VendorQueryRecord {
  id: string;
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  status: VendorStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateVendorRequest {
  code: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface UpdateVendorRequest {
  id: string;
  code?: string;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface VendorStatusRequest {
  id: string;
  action: VendorStatusAction;
}
