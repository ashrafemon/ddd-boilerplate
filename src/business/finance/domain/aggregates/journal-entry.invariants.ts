import { JournalEntryStatus } from '../types/finance.enum';

export class JournalEntryInvariants {
  static enforceJournalEntryCreate(entryNo: string, postingDate: Date): void {
    if (!entryNo?.trim()) {
      throw Object.assign(new Error('Journal entry number is required'), { statusCode: 422 });
    }
    if (!postingDate || isNaN(postingDate.getTime())) {
      throw Object.assign(new Error('Posting date is required'), { statusCode: 422 });
    }
  }

  static enforceJournalEntryBalanced(totalDebit: number, totalCredit: number): void {
    if (totalDebit !== totalCredit) {
      throw Object.assign(
        new Error(`Journal entry is not balanced: debit ${totalDebit} !== credit ${totalCredit}`),
        { statusCode: 422 },
      );
    }
  }

  static enforceJournalEntryStatusTransition(
    status: JournalEntryStatus,
    to: JournalEntryStatus,
  ): void {
    if (status === to) return;

    const allowed: Record<JournalEntryStatus, JournalEntryStatus[]> = {
      [JournalEntryStatus.DRAFT]: [JournalEntryStatus.POSTED],
      [JournalEntryStatus.POSTED]: [JournalEntryStatus.REVERSED],
      [JournalEntryStatus.REVERSED]: [],
    };

    if (!allowed[status].includes(to)) {
      throw Object.assign(new Error(`Invalid journal entry transition: ${status} -> ${to}`), {
        statusCode: 422,
      });
    }
  }
}
