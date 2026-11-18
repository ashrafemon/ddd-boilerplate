import { ConflictException, ForbiddenException } from '@nestjs/common';
import { CreatePurchaseOrderUseCase } from '@business/procurement/purchase-order/application/use-cases/create-purchase-order.usecase';
import { PurchaseOrderCommandRepository } from '@business/procurement/purchase-order/domain/repositories/purchase-order-command.repository';
import { OrderableVendorPort } from '@business/procurement/purchase-order/application/outbound-ports/vendor-query.port';
import { PurchaseOrderPublisherPort } from '@business/procurement/purchase-order/application/publishes/publishers/purchase-order.publisher-port';
import { NumberingPort } from '@business/procurement/purchase-order/application/outbound-ports/numbering.port';
import { AbacPort } from '@platform/platform-organization/authorization/ports/abac.port';
import {
  AbacResult,
  AbacCheck,
} from '@platform/platform-organization/authorization/ports/abac.port';
import { VendorReference } from '@business/party/vendor/public/contracts/vendor-for-purchase.contract';
import { PurchaseOrder } from '@business/procurement/purchase-order/domain/aggregates/purchase-order.aggregate';
import { OutboxEvent } from '@platform/platform-common/outbox/types/outbox.types';
import { InMemoryRequestContextService } from '@test/support/context/in-memory-request-context';
import { initNoopTransactionHost } from '@test/utils/noop-transaction-host';

// ---- Fakes / in-memory adapters ----

class InMemoryPurchaseOrderRepository extends PurchaseOrderCommandRepository {
  public readonly saved: PurchaseOrder[] = [];

  async save(purchaseOrder: PurchaseOrder): Promise<PurchaseOrder> {
    this.saved.push(purchaseOrder);
    return purchaseOrder;
  }
  async update(purchaseOrder: PurchaseOrder): Promise<PurchaseOrder> {
    return purchaseOrder;
  }
  async findById(): Promise<PurchaseOrder | null> {
    return null;
  }
  async findByOrderNumber(): Promise<PurchaseOrder | null> {
    return null;
  }
  async findByExternalReference(): Promise<PurchaseOrder | null> {
    return null;
  }
}

class InMemoryVendorQueryPort extends OrderableVendorPort {
  constructor(private readonly vendors: Map<string, VendorReference>) {
    super();
  }
  async getOrderableVendor(id: string): Promise<VendorReference | null> {
    const v = this.vendors.get(id);
    if (!v || String(v.status) !== 'ACTIVE') return null;
    return v;
  }
  async findOrderableVendorsByCodes(): Promise<VendorReference[]> {
    return [];
  }
}

class InMemoryNumberingPort extends NumberingPort {
  private counter = 0;
  async nextNumber(
    _sequenceKey: string,
    options?: { prefix?: string; padding?: number },
  ): Promise<string> {
    this.counter++;
    const prefix = options?.prefix ?? 'PO-';
    const padding = options?.padding ?? 8;
    return `${prefix}${String(this.counter).padStart(padding, '0')}`;
  }
}

class InMemoryPublisherPort extends PurchaseOrderPublisherPort {
  public readonly events: OutboxEvent[] = [];
  async send(event: OutboxEvent, _aggregateId: string): Promise<void> {
    this.events.push(event);
  }
}

class AllowAbacAdapter extends AbacPort {
  async evaluate(_check: AbacCheck): Promise<AbacResult> {
    return { decision: 'ALLOW' };
  }
}

class DenyAbacAdapter extends AbacPort {
  async evaluate(_check: AbacCheck): Promise<AbacResult> {
    return { decision: 'DENY', reason: 'Forbidden by policy' };
  }
}

// ---- Test suite ----

describe('CreatePurchaseOrderUseCase (integration)', () => {
  beforeAll(() => {
    initNoopTransactionHost();
  });

  const defaultContext = {
    tenantId: 'tenant-1',
    companyId: 'company-1',
    userId: 'user-1',
    roles: ['admin'],
    defaultCurrency: 'USD',
  };

  function makeSut(overrides?: { vendorStatus?: string; abacDeny?: boolean }) {
    const repo = new InMemoryPurchaseOrderRepository();
    const vendorRef: VendorReference = {
      id: 'vendor-1',
      code: 'VEN-001',
      name: 'Acme',
      email: null,
      phone: null,
      address: null,
      status: overrides?.vendorStatus ?? 'ACTIVE',
    };
    const vendorPort = new InMemoryVendorQueryPort(new Map([['vendor-1', vendorRef]]));
    const numbering = new InMemoryNumberingPort();
    const publisher = new InMemoryPublisherPort();
    const ctx = new InMemoryRequestContextService(defaultContext);
    const abac = overrides?.abacDeny ? new DenyAbacAdapter() : new AllowAbacAdapter();

    const useCase = new CreatePurchaseOrderUseCase(
      repo,
      vendorPort,
      publisher,
      numbering,
      ctx,
      abac,
    );
    return { useCase, repo, publisher, ctx };
  }

  it('creates a purchase order and persists it with outbox event', async () => {
    const { useCase, repo, publisher } = makeSut();

    const id = await useCase.execute({ vendorId: 'vendor-1' });

    expect(id).toBeTruthy();
    expect(repo.saved).toHaveLength(1);
    expect(repo.saved[0].vendorId).toBe('vendor-1');
    expect(repo.saved[0].orderNumber).toBeTruthy();
    expect(publisher.events).toHaveLength(1);
  });

  it('uses provided currency or falls back to context default', async () => {
    const { useCase, repo } = makeSut();
    await useCase.execute({ vendorId: 'vendor-1', currency: 'EUR' });
    expect(repo.saved[0].currency).toBe('EUR');

    const { useCase: useCase2, repo: repo2 } = makeSut();
    await useCase2.execute({ vendorId: 'vendor-1' });
    expect(repo2.saved[0].currency).toBe('USD');
  });

  it('uses provided orderDate and expectedDeliveryDate', async () => {
    const { useCase, repo } = makeSut();
    const orderDate = new Date('2026-01-15');
    const expectedDeliveryDate = new Date('2026-02-15');
    await useCase.execute({
      vendorId: 'vendor-1',
      orderDate,
      expectedDeliveryDate,
    });
    expect(repo.saved[0].orderDate).toEqual(orderDate);
    expect(repo.saved[0].expectedDeliveryDate).toEqual(expectedDeliveryDate);
  });

  it('throws ConflictException when vendor is not orderable', async () => {
    const { useCase } = makeSut({ vendorStatus: 'BLOCKED' });
    await expect(useCase.execute({ vendorId: 'vendor-1' })).rejects.toThrow(ConflictException);
    await expect(useCase.execute({ vendorId: 'vendor-1' })).rejects.toThrow(
      'Vendor is not orderable',
    );
  });

  it('throws ForbiddenException when ABAC denies', async () => {
    const { useCase } = makeSut({ abacDeny: true });
    await expect(useCase.execute({ vendorId: 'vendor-1' })).rejects.toThrow(ForbiddenException);
  });

  it('throws when companyId is missing from context', async () => {
    const repo = new InMemoryPurchaseOrderRepository();
    const vendorPort = new InMemoryVendorQueryPort(new Map<string, never>());
    const numbering = new InMemoryNumberingPort();
    const publisher = new InMemoryPublisherPort();
    const emptyCtx = new InMemoryRequestContextService({ tenantId: 't', userId: 'u', roles: [] });
    const useCase2 = new CreatePurchaseOrderUseCase(
      repo,
      vendorPort,
      publisher,
      numbering,
      emptyCtx,
      new AllowAbacAdapter(),
    );
    await expect(useCase2.execute({ vendorId: 'vendor-1' })).rejects.toThrow('Company not found');
  });

  it('uses actorId from input when provided', async () => {
    const { useCase, repo } = makeSut();
    await useCase.execute({ vendorId: 'vendor-1', actorId: 'custom-actor' });
    expect(repo.saved[0].createdBy).toBe('custom-actor');
  });

  it('falls back to context userId for actorId', async () => {
    const { useCase, repo } = makeSut();
    await useCase.execute({ vendorId: 'vendor-1' });
    expect(repo.saved[0].createdBy).toBe('user-1');
  });

  it('uses externalReference when provided', async () => {
    const { useCase, repo } = makeSut();
    await useCase.execute({ vendorId: 'vendor-1', externalReference: 'PO-REF-001' });
    expect(repo.saved[0].externalReference).toBe('PO-REF-001');
  });
});
