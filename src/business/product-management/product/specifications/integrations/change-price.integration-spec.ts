import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ChangePriceUseCase } from '@business/product-management/product/application/use-cases/change-price.usecase';
import { ProductCommandRepository } from '@business/product-management/product/domain/repositories/product-command.repository';
import { ProductPublisherPort } from '@business/product-management/product/application/publishes/publishers/product.publisher-port';
import { Product } from '@business/product-management/product/domain/aggregates/product.aggregate';
import { ProductFactory } from '@business/product-management/product/domain/factories/product.factory';
import { Money } from '@business/shared-business/domain/common/value-objects/money';
import { OutboxEvent } from '@platform/platform-common/outbox/types/outbox.types';
import {
  AbacPort,
  AbacResult,
  AbacCheck,
} from '@platform/platform-organization/authorization/ports/abac.port';
import { InMemoryRequestContextService } from '@test/support/context/in-memory-request-context';
import { initNoopTransactionHost } from '@test/utils/noop-transaction-host';

class InMemoryProductRepository extends ProductCommandRepository {
  public readonly store = new Map<string, Product>();
  public readonly updates: Product[] = [];
  async findById(id: string): Promise<Product | null> {
    return this.store.get(id) ?? null;
  }
  async findBySku(): Promise<Product | null> {
    return null;
  }
  async save(product: Product): Promise<Product> {
    this.store.set(product.id.toString(), product);
    return product;
  }
  async update(product: Product): Promise<Product> {
    this.updates.push(product);
    return product;
  }
}

class InMemoryProductPublisherPort extends ProductPublisherPort {
  public readonly events: OutboxEvent[] = [];
  async send(event: OutboxEvent, _id: string): Promise<void> {
    this.events.push(event);
  }
}

class AllowAbacAdapter extends AbacPort {
  async evaluate(_c: AbacCheck): Promise<AbacResult> {
    return { decision: 'ALLOW' };
  }
}
class DenyAbacAdapter extends AbacPort {
  async evaluate(_c: AbacCheck): Promise<AbacResult> {
    return { decision: 'DENY', reason: 'Denied' };
  }
}

const defaultContext = {
  tenantId: 'tenant-1',
  companyId: 'company-1',
  userId: 'user-1',
  roles: ['admin'],
  defaultCurrency: 'USD',
};

function makeSut(opts?: { product?: Product; abacDeny?: boolean; noCompany?: boolean }) {
  const repo = new InMemoryProductRepository();
  const product =
    opts?.product ??
    ProductFactory.create({
      sku: 'SKU-100',
      name: 'Mouse',
      unitPrice: Money.fromMinorUnits(1999, 'USD'),
    });
  repo.store.set(product.id.toString(), product);

  const publisher = new InMemoryProductPublisherPort();
  const ctx = new InMemoryRequestContextService(
    opts?.noCompany ? { tenantId: 't', userId: 'u', roles: [] } : defaultContext,
  );
  const abac = opts?.abacDeny ? new DenyAbacAdapter() : new AllowAbacAdapter();
  const useCase = new ChangePriceUseCase(repo, publisher, ctx, abac);
  return { useCase, repo, publisher, ctx, product };
}

describe('ChangePriceUseCase (integration)', () => {
  beforeAll(() => initNoopTransactionHost());

  it('changes the price using the request currency', async () => {
    const { useCase, repo, product } = makeSut();
    await useCase.execute({ id: product.id.toString(), unitPrice: 25.5, currency: 'EUR' });
    const updated = repo.updates[0];
    expect(updated.unitPrice.minorUnits).toBe(2550);
    expect(updated.unitPrice.currency).toBe('EUR');
  });

  it('falls back to the context default currency', async () => {
    const { useCase, repo, product } = makeSut();
    await useCase.execute({ id: product.id.toString(), unitPrice: 10 });
    expect(repo.updates[0].unitPrice.currency).toBe('USD');
  });

  it('raises a ProductUpdated event', async () => {
    const { useCase, publisher, product } = makeSut();
    await useCase.execute({ id: product.id.toString(), unitPrice: 10 });
    expect(publisher.events.length).toBeGreaterThanOrEqual(1);
  });

  it('throws NotFoundException when the product does not exist', async () => {
    const { useCase } = makeSut();
    await expect(useCase.execute({ id: 'missing', unitPrice: 10 })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws NotFoundException when companyId is missing', async () => {
    const { useCase, product } = makeSut({ noCompany: true });
    await expect(useCase.execute({ id: product.id.toString(), unitPrice: 10 })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws ForbiddenException when ABAC denies', async () => {
    const { useCase, product } = makeSut({ abacDeny: true });
    await expect(useCase.execute({ id: product.id.toString(), unitPrice: 10 })).rejects.toThrow(
      ForbiddenException,
    );
  });
});
