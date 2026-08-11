import { Prisma } from '@prisma/client';
import { Address } from '../../../../shared-business/value-object/address';
import { Currency } from '../../../../shared-business/value-object/currency';
import { EmailAddress } from '../../../../shared-business/value-object/email-address';
import { OrganizationId } from '../../../../shared-business/value-object/organization-id';
import { PhoneNumber } from '../../../../shared-business/value-object/phone-number';
import { TenantId } from '../../../../shared-business/value-object/tenant-id';
import { VendorSnapshot } from '../../domain/aggregate/vendor/vendor.entity';
import { VendorId } from '../../domain/aggregate/vendor/vendor-id.vo';
import { VendorAddress } from '../../domain/entity/vendor-address.entity';
import { VendorAddressId } from '../../domain/entity/vendor-address-id.vo';
import { VendorBankAccount } from '../../domain/entity/vendor-bank-account.entity';
import { VendorBankAccountId } from '../../domain/entity/vendor-bank-account.entity';
import { VendorContact } from '../../domain/entity/vendor-contact.entity';
import { VendorContactId } from '../../domain/entity/vendor-contact.entity';
import { Iban } from '../../domain/value-object/iban.vo';
import { TaxIdentifier } from '../../domain/value-object/tax-identifier.vo';
import { VendorCode } from '../../domain/value-object/vendor-code.vo';
import { VendorStatus } from '../../domain/value-object/vendor-status.vo';
import { VendorReadModel } from '../../domain/port/vendor-read-repository.port';

type VendorRow = Prisma.VendorGetPayload<{
  include: { addresses: true; contacts: true; bankAccounts: true };
}>;

/**
 * Maps between the Vendor domain aggregate and its persistence models.
 * Prisma models are never used as domain objects.
 */
export class VendorMapper {
  public static toSnapshot(row: VendorRow): VendorSnapshot {
    return {
      id: VendorId.from(row.id),
      tenantId: TenantId.from(row.tenantId),
      organizationId: OrganizationId.from(row.organizationId),
      code: VendorCode.from(row.code),
      name: row.name,
      status: VendorStatus.from(row.status),
      email: row.email ? EmailAddress.from(row.email) : undefined,
      phone: row.phone ? PhoneNumber.from(row.phone) : undefined,
      taxIdentifier: row.taxIdentifier ? TaxIdentifier.from(row.taxIdentifier) : undefined,
      addresses: row.addresses.map((item) =>
        VendorAddress.reconstitute(
          VendorAddressId.from(item.id),
          item.type,
          Address.from({
            line1: item.line1,
            line2: item.line2 ?? undefined,
            city: item.city,
            state: item.state ?? undefined,
            postalCode: item.postalCode ?? undefined,
            country: item.country,
          }),
        ),
      ),
      contacts: row.contacts.map((item) =>
        VendorContact.reconstitute(
          VendorContactId.from(item.id),
          item.firstName,
          item.lastName,
          EmailAddress.from(item.email),
          item.phone ? PhoneNumber.from(item.phone) : undefined,
          item.role ?? undefined,
          item.isPrimary,
        ),
      ),
      bankAccounts: row.bankAccounts.map((item) =>
        VendorBankAccount.reconstitute(
          VendorBankAccountId.from(item.id),
          item.accountName,
          Iban.from(item.iban),
          item.bankName ?? undefined,
          Currency.from(item.currency),
          item.isDefault,
        ),
      ),
    };
  }

  public static toReadModel(
    row: Prisma.VendorGetPayload<{ include: { addresses: true } }>,
  ): VendorReadModel {
    return {
      id: row.id,
      tenantId: row.tenantId,
      organizationId: row.organizationId,
      code: row.code,
      name: row.name,
      status: row.status,
      email: row.email,
      phone: row.phone,
      taxIdentifier: row.taxIdentifier,
      addresses: row.addresses.map((item) => ({
        id: item.id,
        type: item.type,
        line1: item.line1,
        line2: item.line2,
        city: item.city,
        state: item.state,
        postalCode: item.postalCode,
        country: item.country,
      })),
    };
  }
}
