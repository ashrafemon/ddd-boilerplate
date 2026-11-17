import { NotFoundException } from '@nestjs/common';
import { SubmitPurchaseOrderUseCase } from '@business/procurement/purchase-order/application/use-cases/submit-purchase-order.usecase';
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

function makePo() {
  return makePurchaseOrderWithLines([{ productId: 'p1', quantity: 5, unitPriceMinor: 500 }]);
}

function makeSut(opts?: {
  po?: ReturnType<typeof makePo>;
  abacDeny?: boolean;
  noCompany?: boolean;
}) {
  const repo = new InMemoryPurchaseOrderRepository();
  const po = opts?.po ?? makePo();
  repo.store.set(po.id.toString(), po);
  const publisher = new InMemoryPurchaseOrderPublisherPort();
  const audit = new InMemoryAuditPort();
  const ctx = makeContext(opts?.noCompany ? { companyId: undefined } : undefined);
  const abac = opts?.abacDeny ? new DenyAbacAdapter() : new AllowAbacAdapter();
  const useCase = new SubmitPurchaseOrderUseCase(repo, publisher, ctx, audit, abac);
  return { useCase, repo, publisher, audit, po };
}

describe('SubmitPurchaseOrderUseCase (integration)', () => {
  beforeAll(() => initNoopTransactionHost());

  it('submits a DRAFT purchase order', async () => {
    const { useCase, repo, po } = makeSut();
    const id = await useCase.execute(po.id.toString());
    expect(id).toBe(po.id.toString());
    expect(repo.updates[0].status).toBe(PurchaseOrderStatus.SUBMITTED);
  });

  it('records an audit entry', async () => {
    const { useCase, audit, po } = makeSut();
    await useCase.execute(po.id.toString());
    expect(audit.entries).toHaveLength(1);
    expect(audit.entries[0].action).toBe('purchase-order.submit');
  });

  it('publishes the raised domain events', async () => {
    const { useCase, publisher, po } = makeSut();
    await useCase.execute(po.id.toString());
    expect(publisher.events.length).toBeGreaterThanOrEqual(1);
  });

  it('uses the context userId as actor when none given', async () => {
    const { useCase, audit, po } = makeSut();
    await useCase.execute(po.id.toString());
    expect(audit.entries[0].actorId).toBe(PO_TEST_CONTEXT.userId);
  });

  it('accepts an explicit actorId', async () => {
    const { useCase, audit, po } = makeSut();
    await useCase.execute(po.id.toString(), 'other-actor');
    expect(audit.entries[0].actorId).toBe('other-actor');
  });

  it('throws NotFoundException when the purchase order does not exist', async () => {
    const { useCase } = makeSut();
    await expect(useCase.execute('missing')).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when companyId is missing', async () => {
    const { useCase, po } = makeSut({ noCompany: true });
    await expect(useCase.execute(po.id.toString())).rejects.toThrow(NotFoundException);
  });

  it('does not deny on ABAC (submit only evaluates)', async () => {
    const { useCase, po } = makeSut({ abacDeny: true });
    await expect(useCase.execute(po.id.toString())).resolves.toBe(po.id.toString());
  });
});
