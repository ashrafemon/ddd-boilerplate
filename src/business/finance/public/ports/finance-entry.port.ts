import { FinanceEntryReference } from '../contracts/finance-entry.contract';

export abstract class FinanceEntryPort {
  abstract findJournalEntryByEntryNo(entryNo: string): Promise<FinanceEntryReference | null>;
}
