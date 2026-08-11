import { Entity } from '../../../../shared-business/domain/entity';
import { EmailAddress } from '../../../../shared-business/value-object/email-address';
import { PhoneNumber } from '../../../../shared-business/value-object/phone-number';
import { createUuid } from '../../../../shared-kernel/utilities/uuid';
import { Identifier } from '../../../../shared-business/domain/identifier';

export class VendorContactId extends Identifier {
  public static from(value: string): VendorContactId {
    return new VendorContactId(value);
  }

  public static create(): VendorContactId {
    return new VendorContactId(createUuid());
  }
}

/**
 * Contact person of a Vendor. Part of the Vendor aggregate.
 */
export class VendorContact extends Entity<VendorContactId> {
  private readonly firstName: string;
  private readonly lastName: string;
  private readonly email: EmailAddress;
  private readonly phone?: PhoneNumber;
  private readonly role?: string;
  private readonly isPrimary: boolean;

  private constructor(
    id: VendorContactId,
    firstName: string,
    lastName: string,
    email: EmailAddress,
    phone: PhoneNumber | undefined,
    role: string | undefined,
    isPrimary: boolean,
  ) {
    super(id);
    this.firstName = firstName;
    this.lastName = lastName;
    this.email = email;
    this.phone = phone;
    this.role = role;
    this.isPrimary = isPrimary;
  }

  public static create(input: {
    firstName: string;
    lastName: string;
    email: EmailAddress;
    phone?: PhoneNumber;
    role?: string;
    isPrimary?: boolean;
  }): VendorContact {
    return new VendorContact(
      VendorContactId.create(),
      input.firstName,
      input.lastName,
      input.email,
      input.phone,
      input.role,
      input.isPrimary ?? false,
    );
  }

  public static reconstitute(
    id: VendorContactId,
    firstName: string,
    lastName: string,
    email: EmailAddress,
    phone: PhoneNumber | undefined,
    role: string | undefined,
    isPrimary: boolean,
  ): VendorContact {
    return new VendorContact(id, firstName, lastName, email, phone, role, isPrimary);
  }

  public getFirstName(): string {
    return this.firstName;
  }

  public getLastName(): string {
    return this.lastName;
  }

  public getEmail(): EmailAddress {
    return this.email;
  }

  public getPhone(): PhoneNumber | undefined {
    return this.phone;
  }

  public getRole(): string | undefined {
    return this.role;
  }

  public isPrimaryContact(): boolean {
    return this.isPrimary;
  }
}
