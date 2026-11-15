import { JournalEntryPolicy } from './journal-entry.policy';
import { JournalEntryStatus } from '../types/finance.enum';

describe('JournalEntryPolicy', () => {
  it('allows posting a DRAFT entry with accounting lines', () => {
    expect(() =>
      JournalEntryPolicy.enforceJournalEntryPostAllowed(JournalEntryStatus.DRAFT, true),
    ).not.toThrow();
  });

  it('rejects when there are no accounting entries', () => {
    expect(() =>
      JournalEntryPolicy.enforceJournalEntryPostAllowed(JournalEntryStatus.DRAFT, false),
    ).toThrow('Journal entry must have at least one accounting entry');
  });

  it('rejects a non-draft entry', () => {
    expect(() =>
      JournalEntryPolicy.enforceJournalEntryPostAllowed(JournalEntryStatus.POSTED, true),
    ).toThrow('Cannot post journal entry in status POSTED');
  });
});
