import { Entity } from '../../../../shared-business/domain/entity';
import { Currency } from '../../../../shared-business/value-object/currency';
import { createUuid } from '../../../../shared-kernel/utilities/uuid';
import { Identifier } from '../../../../shared-business/domain/identifier';
import { Iban } from '../value-object/iban.vo';

export class VendorBankAccountId extends Identifier {
  public static from(value: string): VendorBankAccountId {
    return new VendorBankAccountId(value);
  }

  public static create(): VendorBankAccountId {
    return new VendorBankAccountId(createUuid());
  }
}

/**
 * Bank account of a Vendor. Part of the Vendor aggregate.
 */
export class VendorBankAccount extends Entity<VendorBankAccountId> {
  private readonly accountName: string;
  private readonly iban: Iban;
  private readonly bankName?: string;
  private readonly currency: Currency;
  private readonly isDefault: boolean;

  private constructor(
    id: VendorBankAccountId,
    accountName: string,
    iban: Iban,
    bankName: string | undefined,
    currency: Currency,
    isDefault: boolean,
  ) {
    super(id);
    this.accountName = accountName;
    this.iban = iban;
    this.bankName = bankName;
    this.currency = currency;
    this.isDefault = isDefault;
  }

  public static create(input: {
    accountName: string;
    iban: Iban;
    bankName?: string;
    currency: Currency;
    isDefault?: boolean;
  }): VendorBankAccount {
    return new VendorBankAccount(
      VendorBankAccountId.create(),
      input.accountName,
      input.iban,
      input.bankName,
      input.currency,
      input.isDefault ?? false,
    );
  }

  public static reconstitute(
    id: VendorBankAccountId,
    accountName: string,
    iban: Iban,
    bankName: string | undefined,
    currency: Currency,
    isDefault: boolean,
  ): VendorBankAccount {
    return new VendorBankAccount(id, accountName, iban, bankName, currency, isDefault);
  }

  public getAccountName(): string {
    return this.accountName;
  }

  public getIban(): Iban {
    return this.iban;
  }

  public getBankName(): string | undefined {
    return this.bankName;
  }

  public getCurrency(): Currency {
    return this.currency;
  }

  public isDefaultAccount(): boolean {
    return this.isDefault;
  }
}
