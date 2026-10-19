import { ConflictException, NotFoundException } from '@nestjs/common';
import { PurchaseOrderTransitionUseCase } from './purchase-order-transition.usecase';
import { PurchaseOrder } from '../../domain/aggregates/purchase-order.aggregate';
import { PurchaseOrderFactory } from '../../domain/factories/purchase-order.factory';
import { PurchaseOrderId } from '../../domain/value-objects/purchase-order-id.vo';
import { PurchaseOrderCommandRepository } from '../../domain/repositories/purchase-order-command.repository';
import { PurchaseOrderIntegrationPort } from '../integrations/publishes/purchase-order.integration-port';
import { CompanyConfigPort } from '../outbound-ports/company-config.port';
import { HasPurchaseOrderReceiptsUseCase } from './has-purchase-order-receipts.usecase';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { Money } from '@business/shared-business/domain/common/value-objects/money';
import { PurchaseOrderStatus } from '../../domain/types/purchase-order.enum';

// @Transactional needs no DB here — the transaction is not under test.
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
  findByExternalReference() {
    return Promise.resolve(null);
  }
}

describe('PurchaseOrderTransitionUseCase', () => {
  let repo: FakeRepository;
  let audit: { record: jest.Mock };
  let readCache: { invalidate: jest.Mock; getOrLoad: jest.Mock };
  let hasReceipts: { execute: jest.Mock };
  let sent: unknown[];
  let useCase: PurchaseOrderTransitionUseCase;

  const context = {
    getTenantId: () => 'tenant-1',
    getCompanyId: () => 'company-1',
    getUserId: () => 'user-ctx',
  } as unknown as RequestContextPort;

  const companyConfig = {
    getCompanyConfig: () =>
      Promise.resolve({
        companyName: 'Co',
        defaultCurrency: 'USD',
        autoApproveThreshold: 10_000,
        overReceiptTolerance: 0.1,
        isActive: true,
      }),
  } as CompanyConfigPort;

  /** DRAFT→SUBMITTED fixture with one 100.00 line. */
  const submitted = (total: number) => {
    const po = PurchaseOrderFactory.create({ orderNumber: 'PO-00000001', vendorId: 'v1' });
    po.addLine('p1', 1, Money.fromDecimal(String(total)));
    po.pullEvents();
    po.submit();
    po.pullEvents();
    return po;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new FakeRepository();
    sent = [];
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    readCache = {
      invalidate: jest.fn().mockResolvedValue(undefined),
      getOrLoad: jest.fn((_id: string, load: () => unknown) => Promise.resolve(load())),
    };
    hasReceipts = { execute: jest.fn().mockResolvedValue(false) };
    const integration = {
      send: (event: unknown) => {
        sent.push(event);
        return Promise.resolve(undefined);
      },
    } as PurchaseOrderIntegrationPort;

    useCase = new PurchaseOrderTransitionUseCase(
      repo,
      integration,
      companyConfig,
      hasReceipts as unknown as HasPurchaseOrderReceiptsUseCase,
      context,
      audit,
      readCache,
    );
  });

  it('approves a below-threshold order, stamps the actor, audits and invalidates the cache', async () => {
    const po = submitted(100);
    await repo.save(po);

    const id = await useCase.execute({ id: po.id.toString(), transition: 'approve' });

    const stored = repo.store.get(id.toString())!;
    expect(stored.status).toBe(PurchaseOrderStatus.APPROVED);
    expect(stored.approvedBy).toBe('user-ctx');
    expect(stored.approvedAt).toBeInstanceOf(Date);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'purchase-order.approve',
        entityType: 'PurchaseOrder',
        entityId: id.toString(),
        actorId: 'user-ctx',
        tenantId: 'tenant-1',
        companyId: 'company-1',
      }),
    );
    expect(readCache.invalidate).toHaveBeenCalledWith(id.toString());
    expect(sent).toHaveLength(1);
  });

  it('B3: throws 409 for above-threshold approval instead of silently no-opping', async () => {
    const po = submitted(50_000); // > autoApproveThreshold 10_000
    await repo.save(po);

    await expect(
      useCase.execute({ id: po.id.toString(), transition: 'approve' }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(repo.store.get(po.id.toString())!.status).toBe(PurchaseOrderStatus.SUBMITTED);
    expect(audit.record).not.toHaveBeenCalled();
    expect(repo.updates).toBe(0);
  });

  it('writes exactly one audit row per successful transition and none when it throws', async () => {
    const po = submitted(100);
    await repo.save(po);

    await useCase.execute({ id: po.id.toString(), transition: 'approve' });
    expect(audit.record).toHaveBeenCalledTimes(1);

    // Invalid transition: domain throws before the state write → no audit row.
    await expect(
      useCase.execute({ id: po.id.toString(), transition: 'submit' }),
    ).rejects.toMatchObject({ statusCode: 422 });
    expect(audit.record).toHaveBeenCalledTimes(1);
    expect(readCache.invalidate).toHaveBeenCalledTimes(1);
  });

  it('cancel: CancellationPolicy blocks when the PO has posted receipts', async () => {
    const po = submitted(100);
    await repo.save(po);
    hasReceipts.execute.mockResolvedValue(true);

    await expect(
      useCase.execute({ id: po.id.toString(), transition: 'cancel' }),
    ).rejects.toMatchObject({ statusCode: 422 });

    const stored = repo.store.get(po.id.toString())!;
    expect(stored.status).toBe(PurchaseOrderStatus.SUBMITTED);
    expect(stored.cancelledBy).toBeNull();
    expect(audit.record).not.toHaveBeenCalled();
    expect(readCache.invalidate).not.toHaveBeenCalled();
  });

  it('cancel: allowed without receipts — consults the PO receipt projection, stamps and audits', async () => {
    const po = submitted(100);
    await repo.save(po);

    await useCase.execute({ id: po.id.toString(), transition: 'cancel' });

    expect(hasReceipts.execute).toHaveBeenCalledWith(po.id.toString());
    const stored = repo.store.get(po.id.toString())!;
    expect(stored.status).toBe(PurchaseOrderStatus.CANCELLED);
    expect(stored.cancelledBy).toBe('user-ctx');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'purchase-order.cancel' }),
    );
    expect(readCache.invalidate).toHaveBeenCalledWith(po.id.toString());
  });

  it('reject: stores the provided reason and actor (no silent default from the API)', async () => {
    const po = submitted(100);
    await repo.save(po);

    await useCase.execute({
      id: po.id.toString(),
      transition: 'reject',
      reason: 'Budget exceeded',
    });

    const stored = repo.store.get(po.id.toString())!;
    expect(stored.status).toBe(PurchaseOrderStatus.REJECTED);
    expect(stored.rejectionReason).toBe('Budget exceeded');
    expect(stored.rejectedBy).toBe('user-ctx');
    expect(stored.rejectedAt).toBeInstanceOf(Date);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'purchase-order.reject',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        changes: expect.objectContaining({ reason: 'Budget exceeded' }),
      }),
    );
  });

  it('prefers the explicit input actorId over the ambient context (worker override, §1.2)', async () => {
    const po = submitted(100);
    await repo.save(po);

    await useCase.execute({
      id: po.id.toString(),
      transition: 'approve',
      actorId: 'batch-worker',
    });

    expect(repo.store.get(po.id.toString())!.approvedBy).toBe('batch-worker');
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ actorId: 'batch-worker' }));
  });

  it('404s for an unknown purchase order', async () => {
    await expect(
      useCase.execute({ id: '00000000-0000-0000-0000-000000000000', transition: 'submit' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
