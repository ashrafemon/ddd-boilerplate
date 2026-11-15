import { JournalEntryInvariants } from './journal-entry.invariants';
import { JournalEntryStatus } from '../types/finance.enum';

const postingDate = new Date('2026-01-01');

describe('JournalEntryInvariants', () => {
  describe('enforceJournalEntryCreate', () => {
    it('accepts valid input', () => {
      expect(() =>
        JournalEntryInvariants.enforceJournalEntryCreate('JE-1', postingDate),
      ).not.toThrow();
    });

    it('requires an entry number', () => {
      expect(() => JournalEntryInvariants.enforceJournalEntryCreate('', postingDate)).toThrow(
        'Journal entry number is required',
      );
    });

    it('requires a posting date', () => {
      expect(() =>
        JournalEntryInvariants.enforceJournalEntryCreate('JE-1', new Date('nope')),
      ).toThrow('Posting date is required');
    });
  });

  describe('enforceJournalEntryBalanced', () => {
    it('accepts equal debits and credits', () => {
      expect(() => JournalEntryInvariants.enforceJournalEntryBalanced(100, 100)).not.toThrow();
    });

    it('rejects an unbalanced entry', () => {
      expect(() => JournalEntryInvariants.enforceJournalEntryBalanced(100, 90)).toThrow(
        'Journal entry is not balanced',
      );
    });
  });

  describe('enforceJournalEntryStatusTransition', () => {
    it.each([
      [JournalEntryStatus.DRAFT, JournalEntryStatus.POSTED],
      [JournalEntryStatus.POSTED, JournalEntryStatus.REVERSED],
    ])('allows %s -> %s', (from, to) => {
      expect(() =>
        JournalEntryInvariants.enforceJournalEntryStatusTransition(from, to),
      ).not.toThrow();
    });

    it('rejects DRAFT -> REVERSED', () => {
      expect(() =>
        JournalEntryInvariants.enforceJournalEntryStatusTransition(
          JournalEntryStatus.DRAFT,
          JournalEntryStatus.REVERSED,
        ),
      ).toThrow('Invalid journal entry transition');
    });

    it('rejects REVERSED -> anything', () => {
      expect(() =>
        JournalEntryInvariants.enforceJournalEntryStatusTransition(
          JournalEntryStatus.REVERSED,
          JournalEntryStatus.POSTED,
        ),
      ).toThrow('Invalid journal entry transition');
    });

    it('allows a no-op transition', () => {
      expect(() =>
        JournalEntryInvariants.enforceJournalEntryStatusTransition(
          JournalEntryStatus.DRAFT,
          JournalEntryStatus.DRAFT,
        ),
      ).not.toThrow();
    });
  });
});
