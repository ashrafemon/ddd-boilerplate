import { JournalEntryId } from './journal-entry-id.vo';

describe('JournalEntryId', () => {
  it('wraps a string value', () => {
    expect(JournalEntryId.fromString('je-1').value).toBe('je-1');
  });

  it('generates a UUID', () => {
    expect(JournalEntryId.generate().value).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('stringifies to its value', () => {
    expect(JournalEntryId.fromString('je-1').toString()).toBe('je-1');
  });
});
