import { NotFoundException } from '@nestjs/common';
import { PostJournalEntryUseCase } from '@business/finance/application/use-cases/post-journal-entry.usecase';
import { JournalEntryStatus } from '@business/finance/domain/types/finance.enum';
import {
  InMemoryJournalEntryRepository,
  InMemoryFinancePublisherPort,
  InMemoryFinanceAuditPort,
  AllowAbacAdapter,
  makeFinanceContext,
} from '@test/support/finance/finance.fakes';
import { initNoopTransactionHost } from '@test/utils/noop-transaction-host';

const input = {
  entryNo: 'JE-0001',
  reference: 'ref-1',
  postingDate: new Date('2026-01-15'),
  entries: [{ account: 'CASH', debit: 100, credit: 0, currency: 'USD' }],
};

describe('PostJournalEntryUseCase (integration)', () => {
  beforeAll(() => initNoopTransactionHost());

  function makeSut(opts?: { noCompany?: boolean }) {
    const repo = new InMemoryJournalEntryRepository();
    const publisher = new InMemoryFinancePublisherPort();
    const audit = new InMemoryFinanceAuditPort();
    const ctx = makeFinanceContext(opts?.noCompany ? { companyId: undefined } : undefined);
    const useCase = new PostJournalEntryUseCase(
      repo,
      publisher,
      ctx,
      new AllowAbacAdapter(),
      audit,
    );
    return { useCase, repo, publisher, audit };
  }

  it('records a draft journal entry', async () => {
    const { useCase, repo } = makeSut();
    const id = await useCase.execute(input);

    expect(id).toBeTruthy();
    expect(repo.saved).toHaveLength(1);
    expect(repo.saved[0].status).toBe(JournalEntryStatus.DRAFT);
    expect(repo.saved[0].entryNo).toBe('JE-0001');
  });

  it('publishes the recorded event', async () => {
    const { useCase, publisher } = makeSut();
    await useCase.execute(input);
    expect(publisher.events.length).toBeGreaterThanOrEqual(1);
  });

  it('records an audit entry', async () => {
    const { useCase, audit } = makeSut();
    await useCase.execute(input);
    expect(audit.entries[0].action).toBe('finance.post-journal-entry');
    expect(audit.entries[0].changes).toMatchObject({ entryNo: 'JE-0001' });
  });

  it('throws NotFoundException when companyId is missing', async () => {
    const { useCase } = makeSut({ noCompany: true });
    await expect(useCase.execute(input)).rejects.toThrow(NotFoundException);
  });

  it('rejects an empty entry number through the aggregate invariant', async () => {
    const { useCase } = makeSut();
    await expect(useCase.execute({ ...input, entryNo: '' })).rejects.toThrow(
      'Journal entry number is required',
    );
  });
});
