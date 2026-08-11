import { Injectable } from '@nestjs/common';
import { EmailAddress } from '../../../../shared-business/value-object/email-address';
import { OrganizationId } from '../../../../shared-business/value-object/organization-id';
import { PhoneNumber } from '../../../../shared-business/value-object/phone-number';
import { TenantId } from '../../../../shared-business/value-object/tenant-id';
import { createUuid } from '../../../../shared-kernel/utilities/uuid';
import { VendorAddress } from '../entity/vendor-address.entity';
import { VendorBankAccount } from '../entity/vendor-bank-account.entity';
import { VendorContact } from '../entity/vendor-contact.entity';
import { Vendor, VendorSnapshot } from '../aggregate/vendor/vendor.entity';
import { VendorId } from '../aggregate/vendor/vendor-id.vo';
import { Currency } from '../../../../shared-business/value-object/currency';
import { Address } from '../../../../shared-business/value-object/address';
import { Iban } from '../value-object/iban.vo';
import { TaxIdentifier } from '../value-object/tax-identifier.vo';
import { VendorCode } from '../value-object/vendor-code.vo';

export interface CreateVendorData {
  id?: VendorId;
  tenantId: TenantId;
  organizationId: OrganizationId;
  code: string;
  name: string;
  email?: string;
  phone?: string;
  taxIdentifier?: string;
  addresses?: Array<{ type: string; line1: string; line2?: string; city: string; state?: string; postalCode?: string; country: string }>;
  contacts?: Array<{ firstName: string; lastName: string; email: string; phone?: string; role?: string; isPrimary?: boolean }>;
  bankAccounts?: Array<{ accountName: string; iban: string; bankName?: string; currency: string; isDefault?: boolean }>;
}

/**
 * Domain builder for the Vendor aggregate. Responsible for constructing valid
 * aggregate instances for both creation and reconstitution; use cases never
 * assemble entities/value objects manually.
 */
@Injectable()
export class VendorBuilder {
  public create(data: CreateVendorData): Vendor {
    const vendor = Vendor.create({
      id: data.id ?? VendorId.from(createUuid()),
      tenantId: data.tenantId,
      organizationId: data.organizationId,
      code: VendorCode.from(data.code),
      name: data.name.trim(),
      email: data.email !== undefined ? EmailAddress.from(data.email) : undefined,
      phone: data.phone !== undefined ? PhoneNumber.from(data.phone) : undefined,
      taxIdentifier: data.taxIdentifier !== undefined ? TaxIdentifier.from(data.taxIdentifier) : undefined,
      addresses: (data.addresses ?? []).map((item) =>
        VendorAddress.create(
          item.type,
          Address.from({ line1: item.line1, line2: item.line2, city: item.city, state: item.state, postalCode: item.postalCode, country: item.country }),
        ),
      ),
      contacts: (data.contacts ?? []).map((item) =>
        VendorContact.create({
          firstName: item.firstName,
          lastName: item.lastName,
          email: EmailAddress.from(item.email),
          phone: item.phone !== undefined ? PhoneNumber.from(item.phone) : undefined,
          role: item.role,
          isPrimary: item.isPrimary,
        }),
      ),
      bankAccounts: (data.bankAccounts ?? []).map((item) =>
        VendorBankAccount.create({
          accountName: item.accountName,
          iban: Iban.from(item.iban),
          bankName: item.bankName,
          currency: Currency.from(item.currency),
          isDefault: item.isDefault,
        }),
      ),
    });

    vendor.markCreated();
    return vendor;
  }

  public reconstitute(snapshot: VendorSnapshot): Vendor {
    return Vendor.reconstitute(snapshot);
  }

  public buildSnapshot(vendor: Vendor): VendorSnapshot {
    return {
      id: vendor.getId(),
      tenantId: vendor.getTenantId(),
      organizationId: vendor.getOrganizationId(),
      code: vendor.getCode(),
      name: vendor.getName(),
      status: vendor.getStatus(),
      email: vendor.getEmail(),
      phone: vendor.getPhone(),
      taxIdentifier: vendor.getTaxIdentifier(),
      addresses: [...vendor.getAddresses()],
      contacts: [...vendor.getContacts()],
      bankAccounts: [...vendor.getBankAccounts()],
    };
  }
}
