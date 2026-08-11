import { AggregateRoot } from '../../../../../shared-business/domain/aggregate-root';
import { OrganizationId } from '../../../../../shared-business/value-object/organization-id';
import { TenantId } from '../../../../../shared-business/value-object/tenant-id';
import { EmailAddress } from '../../../../../shared-business/value-object/email-address';
import { PhoneNumber } from '../../../../../shared-business/value-object/phone-number';
import { ConflictException } from '../../../../../shared-kernel/exceptions/conflict.exception';
import { VendorAddress } from '../../entity/vendor-address.entity';
import { VendorContact } from '../../entity/vendor-contact.entity';
import { VendorBankAccount } from '../../entity/vendor-bank-account.entity';
import { VendorActivatedEvent } from '../../event/vendor-activated.event';
import { VendorCreatedEvent } from '../../event/vendor-created.event';
import { VendorDeactivatedEvent } from '../../event/vendor-deactivated.event';
import { VendorUpdatedEvent } from '../../event/vendor-updated.event';
import { TaxIdentifier } from '../../value-object/tax-identifier.vo';
import { VendorCode } from '../../value-object/vendor-code.vo';
import { VendorStatus, VendorStatusValue } from '../../value-object/vendor-status.vo';
import { VendorId } from './vendor-id.vo';

export interface VendorSnapshot {
  id: VendorId;
  tenantId: TenantId;
  organizationId: OrganizationId;
  code: VendorCode;
  name: string;
  status: VendorStatus;
  email?: EmailAddress;
  phone?: PhoneNumber;
  taxIdentifier?: TaxIdentifier;
  addresses: VendorAddress[];
  contacts: VendorContact[];
  bankAccounts: VendorBankAccount[];
}

/**
 * Vendor aggregate root. All child entities (addresses, contacts, bank
 * accounts) are protected and can only be mutated through this aggregate.
 */
export class Vendor extends AggregateRoot<VendorId> {
  private readonly tenantId: TenantId;
  private readonly organizationId: OrganizationId;
  private code!: VendorCode;
  private name!: string;
  private status!: VendorStatus;
  private email?: EmailAddress;
  private phone?: PhoneNumber;
  private taxIdentifier?: TaxIdentifier;
  private addresses: VendorAddress[] = [];
  private contacts: VendorContact[] = [];
  private bankAccounts: VendorBankAccount[] = [];

  private constructor(id: VendorId, tenantId: TenantId, organizationId: OrganizationId) {
    super(id);
    this.tenantId = tenantId;
    this.organizationId = organizationId;
  }

  public static create(input: {
    id: VendorId;
    tenantId: TenantId;
    organizationId: OrganizationId;
    code: VendorCode;
    name: string;
    status?: VendorStatus;
    email?: EmailAddress;
    phone?: PhoneNumber;
    taxIdentifier?: TaxIdentifier;
    addresses?: VendorAddress[];
    contacts?: VendorContact[];
    bankAccounts?: VendorBankAccount[];
  }): Vendor {
    const vendor = new Vendor(input.id, input.tenantId, input.organizationId);
    vendor.code = input.code;
    vendor.name = input.name;
    vendor.status = input.status ?? VendorStatus.active();
    vendor.email = input.email;
    vendor.phone = input.phone;
    vendor.taxIdentifier = input.taxIdentifier;
    vendor.addresses = input.addresses ?? [];
    vendor.contacts = input.contacts ?? [];
    vendor.bankAccounts = input.bankAccounts ?? [];
    return vendor;
  }

  public static reconstitute(snapshot: VendorSnapshot): Vendor {
    const vendor = new Vendor(snapshot.id, snapshot.tenantId, snapshot.organizationId);
    vendor.code = snapshot.code;
    vendor.name = snapshot.name;
    vendor.status = snapshot.status;
    vendor.email = snapshot.email;
    vendor.phone = snapshot.phone;
    vendor.taxIdentifier = snapshot.taxIdentifier;
    vendor.addresses = snapshot.addresses;
    vendor.contacts = snapshot.contacts;
    vendor.bankAccounts = snapshot.bankAccounts;
    vendor.clearDomainEvents();
    return vendor;
  }

  public getTenantId(): TenantId {
    return this.tenantId;
  }

  public getOrganizationId(): OrganizationId {
    return this.organizationId;
  }

  public getCode(): VendorCode {
    return this.code;
  }

  public getName(): string {
    return this.name;
  }

  public getStatus(): VendorStatus {
    return this.status;
  }

  public isActive(): boolean {
    return this.status.isActive();
  }

  public getEmail(): EmailAddress | undefined {
    return this.email;
  }

  public getPhone(): PhoneNumber | undefined {
    return this.phone;
  }

  public getTaxIdentifier(): TaxIdentifier | undefined {
    return this.taxIdentifier;
  }

  public getAddresses(): readonly VendorAddress[] {
    return [...this.addresses];
  }

  public getContacts(): readonly VendorContact[] {
    return [...this.contacts];
  }

  public getBankAccounts(): readonly VendorBankAccount[] {
    return [...this.bankAccounts];
  }

  public activate(): void {
    this.assertCanTransitionTo(VendorStatusValue.ACTIVE);
    this.status = VendorStatus.active();
    this.recordDomainEvent(new VendorActivatedEvent(this.getId().getValue()));
  }

  public deactivate(): void {
    this.assertCanTransitionTo(VendorStatusValue.INACTIVE);
    this.status = VendorStatus.inactive();
    this.recordDomainEvent(new VendorDeactivatedEvent(this.getId().getValue()));
  }

  public updateProfile(input: {
    name?: string;
    email?: EmailAddress;
    phone?: PhoneNumber;
    taxIdentifier?: TaxIdentifier;
  }): void {
    if (input.name !== undefined && input.name.trim().length > 0) {
      this.name = input.name;
    }
    if (input.email !== undefined) this.email = input.email;
    if (input.phone !== undefined) this.phone = input.phone;
    if (input.taxIdentifier !== undefined) this.taxIdentifier = input.taxIdentifier;
    this.recordDomainEvent(new VendorUpdatedEvent(this.getId().getValue()));
  }

  public addAddress(address: VendorAddress): void {
    this.addresses = [...this.addresses, address];
    this.recordDomainEvent(new VendorUpdatedEvent(this.getId().getValue()));
  }

  public removeAddress(addressId: string): void {
    this.addresses = this.addresses.filter((address) => address.getId().getValue() !== addressId);
    this.recordDomainEvent(new VendorUpdatedEvent(this.getId().getValue()));
  }

  public addContact(contact: VendorContact): void {
    this.contacts = [...this.contacts, contact];
    this.recordDomainEvent(new VendorUpdatedEvent(this.getId().getValue()));
  }

  public addBankAccount(bankAccount: VendorBankAccount): void {
    this.bankAccounts = [...this.bankAccounts, bankAccount];
    this.recordDomainEvent(new VendorUpdatedEvent(this.getId().getValue()));
  }

  public markCreated(): void {
    this.recordDomainEvent(
      new VendorCreatedEvent(this.getId().getValue(), this.code.getValue(), this.name),
    );
  }

  private assertCanTransitionTo(target: VendorStatusValue): void {
    if (!this.status.canTransitionTo(target)) {
      throw new ConflictException(
        `Cannot transition vendor status from ${this.status.getValue()} to ${target}`,
      );
    }
  }
}
