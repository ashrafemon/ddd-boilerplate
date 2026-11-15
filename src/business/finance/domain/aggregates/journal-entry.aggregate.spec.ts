import { JournalEntry } from './journal-entry.aggregate';
import { JournalEntryStatus } from '../types/finance.enum';

const input = {
  entryNo: 'JE-0001',
  reference: 'ref-1',
  postingDate: new Date('2026-01-01'),
  companyId: 'company-1',
  tenantId: 'tenant-1',
};

describe('JournalEntry', () => {
  it('records a DRAFT entry', () => {
    const entry = JournalEntry.record(input);
    expect(entry.entryNo).toBe('JE-0001');
    expect(entry.reference).toBe('ref-1');
    expect(entry.status).toBe(JournalEntryStatus.DRAFT);
    expect(entry.companyId).toBe('company-1');
    expect(entry.tenantId).toBe('tenant-1');
  });

  it('defaults reference to null', () => {
    const entry = JournalEntry.record({ ...input, reference: undefined });
    expect(entry.reference).toBeNull();
  });

  it('raises JournalEntryRecorded on record', () => {
    const entry = JournalEntry.record(input);
    expect(entry.pullEvents()).toHaveLength(1);
  });

  it('posts a draft entry', () => {
    const entry = JournalEntry.record(input);
    entry.pullEvents();
    entry.post();
    expect(entry.status).toBe(JournalEntryStatus.POSTED);
    expect(entry.pullEvents()).toHaveLength(1);
  });

  it('reverses a posted entry', () => {
    const entry = JournalEntry.record(input);
    entry.pullEvents();
    entry.post();
    entry.pullEvents();
    entry.reverse();
    expect(entry.status).toBe(JournalEntryStatus.REVERSED);
    expect(entry.pullEvents()).toHaveLength(1);
  });

  it('rejects posting an already-posted entry', () => {
    const entry = JournalEntry.record(input);
    entry.pullEvents();
    entry.post();
    expect(() => entry.post()).toThrow('Cannot post journal entry in status POSTED');
  });

  it('rejects reversing a draft', () => {
    const entry = JournalEntry.record(input);
    expect(() => entry.reverse()).toThrow('Invalid journal entry transition');
  });

  it('rejects an empty entry number', () => {
    expect(() => JournalEntry.record({ ...input, entryNo: '' })).toThrow(
      'Journal entry number is required',
    );
  });
});
