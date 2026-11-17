import { NotFoundException } from '@nestjs/common';
import { AddGrnLineUseCase } from '@business/procurement/purchase-goods-receipt/application/use-cases/add-grn-line.usecase';
import { SetGrnLineTrackingUseCase } from '@business/procurement/purchase-goods-receipt/application/use-cases/set-grn-line-tracking.usecase';
import { RecordInspectionResultUseCase } from '@business/procurement/purchase-goods-receipt/application/use-cases/record-inspection-result.usecase';
import { GrnFactory } from '@business/procurement/purchase-goods-receipt/domain/factories/grn.factory';
import {
  InMemoryGrnRepository,
  InMemoryGrnPublisherPort,
} from '@test/support/purchase-goods-receipt/grn.fakes';
import { initNoopTransactionHost } from '@test/utils/noop-transaction-host';

function makeGrn(
  lines?: {
    productId: string;
    orderedQuantity: number;
    receivedQuantity: number;
    unitPrice: number;
  }[],
) {
  return GrnFactory.create({
    grnNumber: 'GRN-00000001',
    purchaseOrderId: 'po-1',
    vendorId: 'vendor-1',
    currency: 'USD',
    lines: lines ?? [{ productId: 'p1', orderedQuantity: 10, receivedQuantity: 8, unitPrice: 500 }],
  });
}

describe('AddGrnLineUseCase (integration)', () => {
  beforeAll(() => initNoopTransactionHost());

  it('adds a new line to a draft GRN', async () => {
    const repo = new InMemoryGrnRepository();
    const grn = makeGrn([]);
    repo.store.set(grn.id.toString(), grn);
    const publisher = new InMemoryGrnPublisherPort();
    const useCase = new AddGrnLineUseCase(repo, publisher);

    const id = await useCase.execute({
      id: grn.id.toString(),
      productId: 'p2',
      orderedQuantity: 5,
      receivedQuantity: 5,
      unitPrice: 100,
    });

    expect(id).toBe(grn.id.toString());
    expect(repo.updates[0].lines).toHaveLength(1);
    expect(publisher.events.length).toBeGreaterThanOrEqual(1);
  });

  it('accumulates into an existing line', async () => {
    const repo = new InMemoryGrnRepository();
    const grn = makeGrn([
      { productId: 'p1', orderedQuantity: 10, receivedQuantity: 8, unitPrice: 500 },
    ]);
    repo.store.set(grn.id.toString(), grn);
    const useCase = new AddGrnLineUseCase(repo, new InMemoryGrnPublisherPort());

    await useCase.execute({
      id: grn.id.toString(),
      productId: 'p1',
      orderedQuantity: 10,
      receivedQuantity: 2,
      unitPrice: 500,
    });

    const line = repo.updates[0].lines.find(l => l.productId === 'p1');
    expect(line?.receivedQuantity).toBe(10);
  });

  it('rejects a non-positive received quantity', async () => {
    const repo = new InMemoryGrnRepository();
    const grn = makeGrn([]);
    repo.store.set(grn.id.toString(), grn);
    const useCase = new AddGrnLineUseCase(repo, new InMemoryGrnPublisherPort());

    await expect(
      useCase.execute({
        id: grn.id.toString(),
        productId: 'p2',
        orderedQuantity: 5,
        receivedQuantity: 0,
        unitPrice: 100,
      }),
    ).rejects.toThrow('GRN line quantity must be positive');
  });

  it('throws NotFoundException when the GRN does not exist', async () => {
    const useCase = new AddGrnLineUseCase(
      new InMemoryGrnRepository(),
      new InMemoryGrnPublisherPort(),
    );
    await expect(
      useCase.execute({
        id: 'missing',
        productId: 'p1',
        orderedQuantity: 1,
        receivedQuantity: 1,
        unitPrice: 1,
      }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('SetGrnLineTrackingUseCase (integration)', () => {
  it('records tracking entries for a line', async () => {
    const repo = new InMemoryGrnRepository();
    const grn = makeGrn();
    repo.store.set(grn.id.toString(), grn);
    const publisher = new InMemoryGrnPublisherPort();
    const useCase = new SetGrnLineTrackingUseCase(repo, publisher);

    const entries = [{ lotNo: 'LOT-1', quantity: 8 }];
    const id = await useCase.execute({
      id: grn.id.toString(),
      productId: 'p1',
      entries,
    });

    expect(id).toBe(grn.id.toString());
    expect(repo.updates[0].lines[0].tracking).toEqual(entries);
    expect(publisher.events.length).toBeGreaterThanOrEqual(1);
  });

  it('throws NotFoundException when the GRN does not exist', async () => {
    const useCase = new SetGrnLineTrackingUseCase(
      new InMemoryGrnRepository(),
      new InMemoryGrnPublisherPort(),
    );
    await expect(useCase.execute({ id: 'missing', productId: 'p1', entries: [] })).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('RecordInspectionResultUseCase (integration)', () => {
  it('records the accepted/rejected split', async () => {
    const repo = new InMemoryGrnRepository();
    const grn = makeGrn();
    grn.receive('user-1'); // inspection only runs on a RECEIVED GRN
    repo.store.set(grn.id.toString(), grn);
    const publisher = new InMemoryGrnPublisherPort();
    const useCase = new RecordInspectionResultUseCase(repo, publisher);

    const id = await useCase.execute({
      id: grn.id.toString(),
      lines: [{ productId: 'p1', acceptedQuantity: 6, rejectedQuantity: 2 }],
    });

    expect(id).toBe(grn.id.toString());
    const line = repo.updates[0].lines[0];
    expect(line.acceptedQuantity).toBe(6);
    expect(line.rejectedQuantity).toBe(2);
    expect(publisher.events.length).toBeGreaterThanOrEqual(1);
  });

  it('throws NotFoundException when the GRN does not exist', async () => {
    const useCase = new RecordInspectionResultUseCase(
      new InMemoryGrnRepository(),
      new InMemoryGrnPublisherPort(),
    );
    await expect(
      useCase.execute({
        id: 'missing',
        lines: [{ productId: 'p1', acceptedQuantity: 1, rejectedQuantity: 0 }],
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
