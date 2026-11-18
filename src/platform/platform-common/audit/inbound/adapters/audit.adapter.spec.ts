import { AuditAdapter } from './audit.adapter';
import { RecordAuditEntryUseCase } from '../../use-cases/record-audit-entry.usecase';
import { AuditEntry } from '../../types/audit.types';

describe('AuditAdapter', () => {
  it('delegates the entry to the use case untouched', async () => {
    const execute = jest.fn<Promise<void>, [AuditEntry]>(async () => undefined);
    const adapter = new AuditAdapter({ execute } as unknown as RecordAuditEntryUseCase);
    const entry: AuditEntry = { action: 'submit', entityType: 'GRN', entityId: 'grn-1' };

    await adapter.record(entry);

    expect(execute.mock.calls[0][0]).toBe(entry);
  });
});
