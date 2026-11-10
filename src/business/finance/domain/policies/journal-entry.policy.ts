import { JournalEntryStatus } from '../types/finance.enum';

export class JournalEntryPolicy {
  static enforceJournalEntryPostAllowed(status: JournalEntryStatus, hasEntries: boolean): void {
    if (!hasEntries) {
      throw Object.assign(new Error('Journal entry must have at least one accounting entry'), {
        statusCode: 422,
      });
    }
    if (status !== JournalEntryStatus.DRAFT) {
      throw Object.assign(new Error(`Cannot post journal entry in status ${status}`), {
        statusCode: 422,
      });
    }
  }
}
