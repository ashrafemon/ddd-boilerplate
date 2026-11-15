import { ConflictException, ForbiddenException } from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';
import { CreateInvoiceUseCase } from '@business/sales/invoice/application/use-cases/create-invoice.usecase';
import { PostInvoiceUseCase } from '@business/sales/invoice/application/use-cases/post-invoice.usecase';
import { InvoiceFactory } from '@business/sales/invoice/domain/factories/invoice.factory';
import { InvoiceStatus } from '@business/sales/invoice/domain/types/invoice.enum';
import {
  InMemoryInvoiceRepository,
  InMemoryInvoicePublisherPort,
  InMemoryInvoiceNumberingPort,
  AllowAbacAdapter,
  DenyAbacAdapter,
  makeInvoiceContext,
} from '@test/support/invoice/invoice.fakes';
import { initNoopTransactionHost } from '@test/utils/noop-transaction-host';

const validInput = {
  customerId: 'customer-1',
  currency: 'USD',
  lines: [{ description: 'Widget', quantity: 2, unitPrice: 10.5 }],
};

describe('CreateInvoiceUseCase (integration)', () => {
  beforeAll(() => initNoopTransactionHost());

  function makeSut(opts?: { abacDeny?: boolean; noCompany?: boolean }) {
    const repo = new InMemoryInvoiceRepository();
    const publisher = new InMemoryInvoicePublisherPort();
    const numbering = new InMemoryInvoiceNumberingPort();
    const ctx = makeInvoiceContext(opts?.noCompany ? { companyId: undefined } : undefined);
    const abac = opts?.abacDeny ? new DenyAbacAdapter() : new AllowAbacAdapter();
    const useCase = new CreateInvoiceUseCase(repo, publisher, numbering, ctx, abac);
    return { useCase, repo, publisher, ctx };
  }

  it('creates an invoice with a generated number', async () => {
    const { useCase, repo, publisher } = makeSut();
    const id = await useCase.execute(validInput);
    expect(id).toBeTruthy();
    expect(repo.saved).toHaveLength(1);
    expect(repo.saved[0].invoiceNo).toBe('INV-00000001');
    expect(repo.saved[0].status).toBe(InvoiceStatus.DRAFT);
    expect(publisher.events.length).toBeGreaterThanOrEqual(1);
  });

  it('falls back to the context default currency', async () => {
    const { useCase, repo } = makeSut();
    await useCase.execute({ customerId: 'customer-1', lines: validInput.lines });
    expect(repo.saved[0].currency).toBe('USD');
  });

  it('throws when companyId is missing', async () => {
    const { useCase } = makeSut({ noCompany: true });
    await expect(useCase.execute(validInput)).rejects.toThrow('Company not found');
  });

  it('throws ForbiddenException when ABAC denies', async () => {
    const { useCase } = makeSut({ abacDeny: true });
    await expect(useCase.execute(validInput)).rejects.toThrow(ForbiddenException);
  });

  it('throws ConflictException when customerId is missing', async () => {
    const { useCase } = makeSut();
    await expect(useCase.execute({ ...validInput, customerId: '' })).rejects.toThrow(
      ConflictException,
    );
  });

  it('throws ConflictException when lines are empty', async () => {
    const { useCase } = makeSut();
    await expect(useCase.execute({ ...validInput, lines: [] })).rejects.toThrow(ConflictException);
  });
});

describe('PostInvoiceUseCase (integration)', () => {
  it('posts a draft invoice', async () => {
    const repo = new InMemoryInvoiceRepository();
    const invoice = InvoiceFactory.create({
      invoiceNo: 'INV-00000001',
      customerId: 'customer-1',
      currency: 'USD',
      lines: [{ description: 'Widget', quantity: 2, unitPrice: 10.5 }],
    });
    repo.store.set(invoice.id.toString(), invoice);

    const publisher = new InMemoryInvoicePublisherPort();
    const useCase = new PostInvoiceUseCase(repo, publisher);

    const id = await useCase.execute(invoice.id.toString());
    expect(id).toBe(invoice.id.toString());
    expect(repo.updates[0].status).toBe(InvoiceStatus.POSTED);
    expect(publisher.events.length).toBeGreaterThanOrEqual(1);
  });

  it('throws NotFoundException when the invoice does not exist', async () => {
    const useCase = new PostInvoiceUseCase(
      new InMemoryInvoiceRepository(),
      new InMemoryInvoicePublisherPort(),
    );
    await expect(useCase.execute('missing')).rejects.toThrow(NotFoundException);
  });
});
