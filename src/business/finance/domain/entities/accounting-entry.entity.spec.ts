import { AccountingEntry } from './accounting-entry.entity';

describe('AccountingEntry', () => {
  it('creates an entry with a generated id', () => {
    const entry = AccountingEntry.create({
      journalEntryId: 'je-1',
      account: 'CASH',
      debit: 100,
      credit: 0,
      currency: 'USD',
      postingDate: new Date('2026-01-01'),
      companyId: 'company-1',
      tenantId: 'tenant-1',
    });

    expect(entry.id).toBeTruthy();
    expect(entry.journalEntryId).toBe('je-1');
    expect(entry.account).toBe('CASH');
    expect(entry.debit).toBe(100);
    expect(entry.credit).toBe(0);
    expect(entry.createdAt).toBeInstanceOf(Date);
  });

  it('accepts a supplied createdAt', () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const entry = AccountingEntry.create({
      journalEntryId: 'je-1',
      account: 'CASH',
      debit: 1,
      credit: 0,
      currency: 'USD',
      postingDate: new Date(),
      companyId: 'c',
      tenantId: null,
      createdAt,
    });
    expect(entry.createdAt).toEqual(createdAt);
  });
});
