import { ConflictException, NotFoundException } from '@nestjs/common';
import { PostGrnUseCase } from '@business/procurement/purchase-goods-receipt/application/use-cases/post-grn.usecase';
import { ReverseGrnUseCase } from '@business/procurement/purchase-goods-receipt/application/use-cases/reverse-grn.usecase';
import { GrnFactory } from '@business/procurement/purchase-goods-receipt/domain/factories/grn.factory';
import { GrnStatus } from '@business/procurement/purchase-goods-receipt/domain/types/grn.enum';
import {
  InMemoryGrnRepository,
  InMemoryGrnPublisherPort,
  InMemoryGrnAuditPort,
  InMemoryPurchaseOrderPort,
  InMemoryGrnNumberingPort,
  makeGrnContext,
} from '@test/support/purchase-goods-receipt/grn.fakes';
import { initNoopTransactionHost } from '@test/utils/noop-transaction-host';

const lines = [{ productId: 'p1', orderedQuantity: 10, receivedQuantity: 8, unitPrice: 500 }];

function makeGrn() {
  return GrnFactory.create({
    grnNumber: 'GRN-00000001',
    purchaseOrderId: 'po-1',
    vendorId: 'vendor-1',
    currency: 'USD',
    lines,
  });
}

describe('PostGrnUseCase (integration)', () => {
  beforeAll(() => initNoopTransactionHost());

  it('posts a received GRN and registers the receipt on the PO', async () => {
    const repo = new InMemoryGrnRepository();
    const grn = makeGrn();
    grn.receive('user-1');
    repo.store.set(grn.id.toString(), grn);

    const poPort = new InMemoryPurchaseOrderPort();
    const audit = new InMemoryGrnAuditPort();
    const useCase = new PostGrnUseCase(
      repo,
      poPort,
      new InMemoryGrnPublisherPort(),
      makeGrnContext(),
      audit,
    );

    const id = await useCase.execute({ id: grn.id.toString(), actorId: 'poster-1' });
    expect(id).toBe(grn.id.toString());
    expect(repo.updates[0].status).toBe(GrnStatus.COMPLETED);
    expect(poPort.receiptsRegistered).toHaveLength(1);
    expect(poPort.receiptsRegistered[0].purchaseOrderId).toBe('po-1');
    expect(audit.entries[0].action).toBe('grn.post');
  });

  it('throws NotFoundException when the GRN does not exist', async () => {
    const useCase = new PostGrnUseCase(
      new InMemoryGrnRepository(),
      new InMemoryPurchaseOrderPort(),
      new InMemoryGrnPublisherPort(),
      makeGrnContext(),
      new InMemoryGrnAuditPort(),
    );
    await expect(useCase.execute({ id: 'missing' })).rejects.toThrow(NotFoundException);
  });
});

describe('ReverseGrnUseCase (integration)', () => {
  function makePosted() {
    const grn = makeGrn();
    grn.receive('user-1');
    grn.complete('user-1');
    return grn;
  }

  it('creates a compensating reversal with mirrored negative quantities', async () => {
    const repo = new InMemoryGrnRepository();
    const original = makePosted();
    repo.store.set(original.id.toString(), original);

    const poPort = new InMemoryPurchaseOrderPort();
    const useCase = new ReverseGrnUseCase(
      repo,
      poPort,
      new InMemoryGrnPublisherPort(),
      makeGrnContext(),
      new InMemoryGrnAuditPort(),
      new InMemoryGrnNumberingPort(),
    );

    const reversalId = await useCase.execute({ id: original.id.toString(), actorId: 'reverser-1' });
    expect(reversalId).toBeTruthy();

    const reversal = repo.saved[0];
    expect(reversal.reversalOfId).toBe(original.id.toString());
    expect(reversal.status).toBe(GrnStatus.COMPLETED);
    expect(reversal.lines[0].receivedQuantity).toBe(-8);

    // the PO receiving balance is returned via the mirror
    expect(poPort.receiptsRegistered).toHaveLength(1);
    expect(poPort.receiptsRegistered[0].lines[0].receivedQuantity).toBe(-8);
  });

  it('rejects reversing a non-posted GRN', async () => {
    const repo = new InMemoryGrnRepository();
    const draft = makeGrn();
    repo.store.set(draft.id.toString(), draft);

    const useCase = new ReverseGrnUseCase(
      repo,
      new InMemoryPurchaseOrderPort(),
      new InMemoryGrnPublisherPort(),
      makeGrnContext(),
      new InMemoryGrnAuditPort(),
      new InMemoryGrnNumberingPort(),
    );

    await expect(useCase.execute({ id: draft.id.toString() })).rejects.toThrow(
      'Only a posted (completed) GRN can be reversed',
    );
  });

  it('rejects reversing an already-reversed GRN', async () => {
    const repo = new InMemoryGrnRepository();
    const original = makePosted();
    repo.store.set(original.id.toString(), original);
    repo.reversalOfIndex.set(original.id.toString(), original);

    const useCase = new ReverseGrnUseCase(
      repo,
      new InMemoryPurchaseOrderPort(),
      new InMemoryGrnPublisherPort(),
      makeGrnContext(),
      new InMemoryGrnAuditPort(),
      new InMemoryGrnNumberingPort(),
    );

    await expect(useCase.execute({ id: original.id.toString() })).rejects.toThrow(
      ConflictException,
    );
  });

  it('throws NotFoundException when the GRN does not exist', async () => {
    const useCase = new ReverseGrnUseCase(
      new InMemoryGrnRepository(),
      new InMemoryPurchaseOrderPort(),
      new InMemoryGrnPublisherPort(),
      makeGrnContext(),
      new InMemoryGrnAuditPort(),
      new InMemoryGrnNumberingPort(),
    );
    await expect(useCase.execute({ id: 'missing' })).rejects.toThrow(NotFoundException);
  });
});
