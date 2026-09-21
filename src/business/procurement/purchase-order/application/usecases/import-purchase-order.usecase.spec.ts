import { ConflictException } from '@nestjs/common';
import { PurchaseOrder } from '../../domain/aggregates/purchase-order.aggregate';
import { PurchaseOrderFactory } from '../../domain/factories/purchase-order.factory';
import { PurchaseOrderId } from '../../domain/value-objects/purchase-order-id.vo';
import { PurchaseOrderCommandRepository } from '../../domain/repositories/purchase-order-command.repository';
import { PurchaseOrderIntegrationPort } from '../integrations/publishes/purchase-order.integration-port';
import { CreatePurchaseOrderUseCase } from './create-purchase-order.usecase';
import { ImportPurchaseOrderUseCase } from './import-purchase-order.usecase';

// @Transactional needs a CLS transaction host; the transaction itself is not under test.
jest.mock('@nestjs-cls/transactional', () => ({ Transactional: () => () => undefined }));

class FakeRepository extends PurchaseOrderCommandRepository {
  readonly store = new Map<string, PurchaseOrder>();
  updates = 0;

  save(po: PurchaseOrder) {
    this.store.set(po.id.toString(), po);
    return Promise.resolve(po);
  }
  update(po: PurchaseOrder) {
    this.updates++;
    this.store.set(po.id.toString(), po);
    return Promise.resolve(po);
  }
  findById(id: PurchaseOrderId) {
    return Promise.resolve(this.store.get(id.toString()) ?? null);
  }
  findByOrderNumber() {
    return Promise.resolve(null);
  }
  findByExternalReference(ref: string) {
    return Promise.resolve([...this.store.values()].find(p => p.externalReference === ref) ?? null);
  }
  nextOrderSequence() {
    return Promise.resolve(this.store.size + 1);
  }
}

describe('ImportPurchaseOrderUseCase', () => {
  let repo: FakeRepository;
  let sent: unknown[];
  let useCase: ImportPurchaseOrderUseCase;

  beforeEach(() => {
    repo = new FakeRepository();
    sent = [];
    // Stand-in for CreatePurchaseOrderUseCase: same effect (factory + save), no ports.
    const create = {
      execute: async (input: {
        vendorId: string;
        currency?: string;
        externalReference?: string;
      }) => {
        const po = PurchaseOrderFactory.create({
          orderNumber: `PO-${String(repo.store.size + 1).padStart(8, '0')}`,
          vendorId: input.vendorId,
          currency: input.currency ?? 'USD',
          externalReference: input.externalReference,
        });
        po.pullEvents();
        await repo.save(po);
        return po.id;
      },
    } as unknown as CreatePurchaseOrderUseCase;
    const integration = {
      send: (event: unknown) => {
        sent.push(event);
        return Promise.resolve();
      },
    } as PurchaseOrderIntegrationPort;
    useCase = new ImportPurchaseOrderUseCase(repo, create, integration);
  });

  const request = (overrides = {}) => ({
    externalReference: 'EXT-1',
    vendorId: 'vendor-1',
    lines: [
      { productId: 'p1', quantity: 2, unitPrice: 10 },
      { productId: 'p2', quantity: 1, unitPrice: 5.5 },
    ],
    ...overrides,
  });

  it('creates a draft PO carrying the external reference and all lines', async () => {
    const id = await useCase.execute(request());
    const po = repo.store.get(id.toString())!;
    expect(po.externalReference).toBe('EXT-1');
    expect(po.lines).toHaveLength(2);
    expect(po.total.amount).toBe(25.5);
    expect(sent).toHaveLength(2); // one LineAdded per new line
  });

  it('is idempotent: re-running converges on the same PO without writes or events', async () => {
    const first = await useCase.execute(request());
    const updatesAfterFirst = repo.updates;
    sent.length = 0;

    const second = await useCase.execute(request());

    expect(second.toString()).toBe(first.toString());
    expect(repo.store.size).toBe(1);
    expect(repo.updates).toBe(updatesAfterFirst);
    expect(sent).toHaveLength(0);
  });

  it('adds lines from a later chunk to the same PO', async () => {
    const id = await useCase.execute(
      request({ lines: [{ productId: 'p1', quantity: 2, unitPrice: 10 }] }),
    );
    await useCase.execute(request({ lines: [{ productId: 'p2', quantity: 3, unitPrice: 1 }] }));
    expect(repo.store.get(id.toString())!.lines).toHaveLength(2);
    expect(repo.store.size).toBe(1);
  });

  it('rejects a different vendor for an existing reference', async () => {
    await useCase.execute(request());
    await expect(useCase.execute(request({ vendorId: 'vendor-2' }))).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rejects a different currency for an existing reference', async () => {
    await useCase.execute(request());
    await expect(useCase.execute(request({ currency: 'EUR' }))).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('refuses to edit a PO that is no longer a draft', async () => {
    const id = await useCase.execute(request());
    repo.store.get(id.toString())!.submit();
    await expect(
      useCase.execute(request({ lines: [{ productId: 'p9', quantity: 1, unitPrice: 1 }] })),
    ).rejects.toThrow();
  });
});
