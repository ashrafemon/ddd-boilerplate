import { VendorId } from '../aggregate/vendor/vendor-id.vo';
import { Vendor } from '../aggregate/vendor/vendor.entity';
import { VendorStatusValue } from '../value-object/vendor-status.vo';

export interface VendorAddressPersistenceData {
  id: string;
  type: string;
  line1: string;
  line2?: string | null;
  city: string;
  state?: string | null;
  postalCode?: string | null;
  country: string;
}

export interface VendorContactPersistenceData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  role?: string | null;
  isPrimary: boolean;
}

export interface VendorBankAccountPersistenceData {
  id: string;
  accountName: string;
  iban: string;
  bankName?: string | null;
  currency: string;
  isDefault: boolean;
}

/**
 * Explicit persistence model for the Vendor write repository.
 *
 * The repository never receives the aggregate. The use case assembles this
 * plain data from the input DTO, the tenant/organization context and the
 * domain identity. The domain is used only to enforce invariants/policies and
 * record domain events; it never generates persistence data.
 *
 * The discriminated union makes creates (all fields required) distinct from
 * partial updates (only the changed fields), so infrastructure never has to
 * guess defaults or cast.
 */
export type VendorPersistenceData =
  | VendorCreatePersistenceData
  | VendorUpdatePersistenceData;

export interface VendorCreatePersistenceData {
  operation: 'create';
  id: string;
  tenantId: string;
  organizationId: string;
  code: string;
  name: string;
  status: VendorStatusValue;
  email?: string | null;
  phone?: string | null;
  taxIdentifier?: string | null;
  addresses?: VendorAddressPersistenceData[];
  contacts?: VendorContactPersistenceData[];
  bankAccounts?: VendorBankAccountPersistenceData[];
}

export interface VendorUpdatePersistenceData {
  operation: 'update';
  id: string;
  code?: string;
  name?: string;
  status?: VendorStatusValue;
  email?: string | null;
  phone?: string | null;
  taxIdentifier?: string | null;
  addresses?: VendorAddressPersistenceData[];
  contacts?: VendorContactPersistenceData[];
  bankAccounts?: VendorBankAccountPersistenceData[];
}

/**
 * Write-side repository for the Vendor aggregate.
 *
 * Domain-owned port: the Vendor bounded context needs persistence. The
 * consumer (Vendor) owns this port; infrastructure implements it.
 */
export abstract class VendorWriteRepositoryPort {
  public abstract save(data: VendorPersistenceData): Promise<void>;

  public abstract findById(id: VendorId): Promise<Vendor | null>;

  public abstract findByCode(
    tenantId: string,
    organizationId: string,
    code: string,
  ): Promise<Vendor | null>;
}
