import { NotFoundException } from '@nestjs/common';
import { ReceiveGrnUseCase } from '@business/procurement/purchase-goods-receipt/application/use-cases/receive-grn.usecase';
import { CancelGrnUseCase } from '@business/procurement/purchase-goods-receipt/application/use-cases/cancel-grn.usecase';
import { GrnFactory } from '@business/procurement/purchase-goods-receipt/domain/factories/grn.factory';
import { GrnStatus } from '@business/procurement/purchase-goods-receipt/domain/types/grn.enum';
import {
  InMemoryGrnRepository,
  InMemoryGrnPublisherPort,
  InMemoryGrnAuditPort,
  makeGrnContext,
} from '@test/support/purchase-goods-receipt/grn.fakes';
import { initNoopTransactionHost } from '@test/utils/noop-transaction-host';

const lineInput = [{ productId: 'p1', orderedQuantity: 10, receivedQuantity: 8, unitPrice: 500 }];

function makeGrn() {
  return GrnFactory.create({
    grnNumber: 'GRN-00000001',
    purchaseOrderId: 'po-1',
    vendorId: 'vendor-1',
    currency: 'USD',
    lines: lineInput,
  });
}

describe('ReceiveGrnUseCase (integration)', () => {
  beforeAll(() => initNoopTransactionHost());

  it('receives a draft GRN', async () => {
    const repo = new InMemoryGrnRepository();
    const grn = makeGrn();
    repo.store.set(grn.id.toString(), grn);
    const audit = new InMemoryGrnAuditPort();
    const useCase = new ReceiveGrnUseCase(
      repo,
      new InMemoryGrnPublisherPort(),
      makeGrnContext(),
      audit,
    );

    const id = await useCase.execute({ id: grn.id.toString(), actorId: 'receiver-1' });
    expect(id).toBe(grn.id.toString());
    expect(repo.updates[0].status).toBe(GrnStatus.RECEIVED);
    expect(audit.entries[0].action).toBe('grn.receive');
  });

  it('emits the received event only once when re-received', async () => {
    const repo = new InMemoryGrnRepository();
    const grn = makeGrn();
    repo.store.set(grn.id.toString(), grn);
    const publisher = new InMemoryGrnPublisherPort();
    const useCase = new ReceiveGrnUseCase(
      repo,
      publisher,
      makeGrnContext(),
      new InMemoryGrnAuditPort(),
    );

    await useCase.execute({ id: grn.id.toString() });
    const afterFirst = publisher.events.length;
    await useCase.execute({ id: grn.id.toString() });
    // the aggregate's receive() is idempotent — the second call emits nothing
    expect(publisher.events).toHaveLength(afterFirst);
  });

  it('throws NotFoundException when the GRN does not exist', async () => {
    const useCase = new ReceiveGrnUseCase(
      new InMemoryGrnRepository(),
      new InMemoryGrnPublisherPort(),
      makeGrnContext(),
      new InMemoryGrnAuditPort(),
    );
    await expect(useCase.execute({ id: 'missing' })).rejects.toThrow(NotFoundException);
  });
});

describe('CancelGrnUseCase (integration)', () => {
  it('cancels a draft GRN', async () => {
    const repo = new InMemoryGrnRepository();
    const grn = makeGrn();
    repo.store.set(grn.id.toString(), grn);
    const audit = new InMemoryGrnAuditPort();
    const useCase = new CancelGrnUseCase(
      repo,
      new InMemoryGrnPublisherPort(),
      makeGrnContext(),
      audit,
    );

    const id = await useCase.execute(grn.id.toString(), 'canceller-1');
    expect(id).toBe(grn.id.toString());
    expect(repo.updates[0].status).toBe(GrnStatus.CANCELLED);
    expect(audit.entries[0].action).toBe('grn.cancel');
  });

  it('throws NotFoundException when the GRN does not exist', async () => {
    const useCase = new CancelGrnUseCase(
      new InMemoryGrnRepository(),
      new InMemoryGrnPublisherPort(),
      makeGrnContext(),
      new InMemoryGrnAuditPort(),
    );
    await expect(useCase.execute('missing')).rejects.toThrow(NotFoundException);
  });
});
