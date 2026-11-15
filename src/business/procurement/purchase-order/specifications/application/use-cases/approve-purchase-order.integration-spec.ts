import { NotFoundException } from '@nestjs/common';
import { ApprovePurchaseOrderUseCase } from '@business/procurement/purchase-order/application/use-cases/approve-purchase-order.usecase';
import { PurchaseOrderStatus } from '@business/procurement/purchase-order/domain/types/purchase-order.enum';
import {
  InMemoryPurchaseOrderRepository,
  InMemoryPurchaseOrderPublisherPort,
  InMemoryAuditPort,
  AllowAbacAdapter,
  DenyAbacAdapter,
  makeContext,
  makePurchaseOrderWithLines,
  PO_TEST_CONTEXT,
} from '@test/support/purchase-order/purchase-order.fakes';
import { initNoopTransactionHost } from '@test/utils/noop-transaction-host';

function makeSubmittedPo() {
  const po = makePurchaseOrderWithLines([{ productId: 'p1', quantity: 5, unitPriceMinor: 500 }], {
    status: PurchaseOrderStatus.SUBMITTED,
  });
  return po;
}

function makeSut(opts?: {
  po?: ReturnType<typeof makeSubmittedPo>;
  abacDeny?: boolean;
  noCompany?: boolean;
}) {
  const repo = new InMemoryPurchaseOrderRepository();
  const po = opts?.po ?? makeSubmittedPo();
  repo.store.set(po.id.toString(), po);
  const publisher = new InMemoryPurchaseOrderPublisherPort();
  const audit = new InMemoryAuditPort();
  const ctx = makeContext(opts?.noCompany ? { companyId: undefined } : undefined);
  const abac = opts?.abacDeny ? new DenyAbacAdapter() : new AllowAbacAdapter();
  const useCase = new ApprovePurchaseOrderUseCase(repo, publisher, ctx, audit, abac);
  return { useCase, repo, publisher, audit, po };
}

describe('ApprovePurchaseOrderUseCase (integration)', () => {
  beforeAll(() => initNoopTransactionHost());

  it('approves a submitted purchase order', async () => {
    const { useCase, repo, po } = makeSut();
    const id = await useCase.execute(po.id.toString());
    expect(id).toBe(po.id.toString());
    expect(repo.updates[0].status).toBe(PurchaseOrderStatus.APPROVED);
  });

  it('records an audit entry', async () => {
    const { useCase, audit, po } = makeSut();
    await useCase.execute(po.id.toString());
    expect(audit.entries[0].action).toBe('purchase-order.approve');
  });

  it('stamps the approver', async () => {
    const { useCase, repo, po } = makeSut();
    await useCase.execute(po.id.toString(), 'approver-1');
    expect(repo.updates[0].approvedBy).toBe('approver-1');
  });

  it('publishes domain events', async () => {
    const { useCase, publisher, po } = makeSut();
    await useCase.execute(po.id.toString());
    expect(publisher.events.length).toBeGreaterThanOrEqual(1);
  });

  it('uses context userId when no actor given', async () => {
    const { useCase, audit, po } = makeSut();
    await useCase.execute(po.id.toString());
    expect(audit.entries[0].actorId).toBe(PO_TEST_CONTEXT.userId);
  });

  it('throws NotFoundException when the purchase order does not exist', async () => {
    const { useCase } = makeSut();
    await expect(useCase.execute('missing')).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when companyId is missing', async () => {
    const { useCase, po } = makeSut({ noCompany: true });
    await expect(useCase.execute(po.id.toString())).rejects.toThrow(NotFoundException);
  });
});
