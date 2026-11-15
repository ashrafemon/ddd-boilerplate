import { NotFoundException } from '@nestjs/common';
import { CreateVendorBillUseCase } from '@business/finance/application/use-cases/create-vendor-bill.usecase';
import { VendorBillStatus } from '@business/finance/domain/types/finance.enum';
import {
  InMemoryVendorBillRepository,
  InMemoryFinancePublisherPort,
  InMemoryFinanceAuditPort,
  AllowAbacAdapter,
  makeFinanceContext,
} from '@test/support/finance/finance.fakes';
import { initNoopTransactionHost } from '@test/utils/noop-transaction-host';

const input = {
  billNo: 'BILL-0001',
  vendorId: 'vendor-1',
  amount: 500,
  currency: 'USD',
  dueDate: new Date('2026-03-01'),
};

describe('CreateVendorBillUseCase (integration)', () => {
  beforeAll(() => initNoopTransactionHost());

  function makeSut(opts?: { noCompany?: boolean }) {
    const repo = new InMemoryVendorBillRepository();
    const publisher = new InMemoryFinancePublisherPort();
    const audit = new InMemoryFinanceAuditPort();
    const ctx = makeFinanceContext(opts?.noCompany ? { companyId: undefined } : undefined);
    const useCase = new CreateVendorBillUseCase(
      repo,
      publisher,
      ctx,
      new AllowAbacAdapter(),
      audit,
    );
    return { useCase, repo, publisher, audit };
  }

  it('creates a draft vendor bill', async () => {
    const { useCase, repo } = makeSut();
    const id = await useCase.execute(input);

    expect(id).toBeTruthy();
    expect(repo.saved).toHaveLength(1);
    expect(repo.saved[0].status).toBe(VendorBillStatus.DRAFT);
    expect(repo.saved[0].amount).toBe(500);
    expect(repo.saved[0].companyId).toBe('company-1');
  });

  it('records an audit entry', async () => {
    const { useCase, audit } = makeSut();
    await useCase.execute(input);
    expect(audit.entries[0].action).toBe('finance.create-vendor-bill');
    expect(audit.entries[0].changes).toMatchObject({ billNo: 'BILL-0001', amount: 500 });
  });

  it('throws NotFoundException when companyId is missing', async () => {
    const { useCase } = makeSut({ noCompany: true });
    await expect(useCase.execute(input)).rejects.toThrow(NotFoundException);
  });

  it('rejects a non-positive amount through the entity invariant', async () => {
    const { useCase } = makeSut();
    await expect(useCase.execute({ ...input, amount: 0 })).rejects.toThrow(
      'Vendor bill amount must be positive',
    );
  });
});
