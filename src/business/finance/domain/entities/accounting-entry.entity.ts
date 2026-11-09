export class AccountingEntry {
  private constructor(
    public readonly id: string,
    public readonly journalEntryId: string,
    public readonly account: string,
    public debit: number,
    public credit: number,
    public currency: string,
    public postingDate: Date,
    public companyId: string,
    public tenantId: string | null,
    public createdAt: Date,
  ) {}

  static create(input: {
    journalEntryId: string;
    account: string;
    debit: number;
    credit: number;
    currency: string;
    postingDate: Date;
    companyId: string;
    tenantId: string | null;
    createdAt?: Date;
  }): AccountingEntry {
    return new AccountingEntry(
      crypto.randomUUID(),
      input.journalEntryId,
      input.account,
      input.debit,
      input.credit,
      input.currency,
      input.postingDate,
      input.companyId,
      input.tenantId,
      input.createdAt ?? new Date(),
    );
  }
}
