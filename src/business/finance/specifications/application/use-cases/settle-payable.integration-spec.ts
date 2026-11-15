import { NotFoundException } from '@nestjs/common';
import { SettlePayableUseCase } from '@business/finance/application/use-cases/settle-payable.usecase';
import { PaymentStatus } from '@business/finance/domain/types/finance.enum';
import {
  InMemoryPaymentRepository,
  InMemoryFinancePublisherPort,
  InMemoryFinanceAuditPort,
  AllowAbacAdapter,
  makeFinanceContext,
} from '@test/support/finance/finance.fakes';
import { initNoopTransactionHost } from '@test/utils/noop-transaction-host';

const input = {
  payableId: 'payable-1',
  paymentAmount: 250,
  currency: 'USD',
  paymentDate: new Date('2026-02-01'),
};

describe('SettlePayableUseCase (integration)', () => {
  beforeAll(() => initNoopTransactionHost());

  function makeSut(opts?: { noCompany?: boolean }) {
    const repo = new InMemoryPaymentRepository();
    const publisher = new InMemoryFinancePublisherPort();
    const audit = new InMemoryFinanceAuditPort();
    const ctx = makeFinanceContext(opts?.noCompany ? { companyId: undefined } : undefined);
    const useCase = new SettlePayableUseCase(repo, publisher, ctx, new AllowAbacAdapter(), audit);
    return { useCase, repo, publisher, audit };
  }

  it('creates and completes a payment', async () => {
    const { useCase, repo } = makeSut();
    const id = await useCase.execute(input);

    expect(id).toBeTruthy();
    expect(repo.saved).toHaveLength(1);
    expect(repo.saved[0].status).toBe(PaymentStatus.COMPLETED);
    expect(repo.saved[0].amount).toBe(250);
    expect(repo.saved[0].currency).toBe('USD');
  });

  it('records an audit entry', async () => {
    const { useCase, audit } = makeSut();
    await useCase.execute(input);
    expect(audit.entries.length).toBeGreaterThanOrEqual(1);
  });

  it('throws NotFoundException when companyId is missing', async () => {
    const { useCase } = makeSut({ noCompany: true });
    await expect(useCase.execute(input)).rejects.toThrow(NotFoundException);
  });

  it('rejects a non-positive payment amount through the entity invariant', async () => {
    const { useCase } = makeSut();
    await expect(useCase.execute({ ...input, paymentAmount: 0 })).rejects.toThrow(
      'Payment amount must be positive',
    );
  });
});
