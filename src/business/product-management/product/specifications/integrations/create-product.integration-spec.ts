import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CreateProductUseCase } from '@business/product-management/product/application/use-cases/create-product.usecase';
import { ProductCommandRepository } from '@business/product-management/product/domain/repositories/product-command.repository';
import { ProductPublisherPort } from '@business/product-management/product/application/publishes/publishers/product.publisher-port';
import { Product } from '@business/product-management/product/domain/aggregates/product.aggregate';
import { OutboxEvent } from '@platform/platform-common/outbox/outbox.types';
import {
  AbacPort,
  AbacResult,
  AbacCheck,
} from '@platform/platform-organization/authorization/ports/abac.port';
import { InMemoryRequestContextService } from '@test/support/context/in-memory-request-context';
import { initNoopTransactionHost } from '@test/utils/noop-transaction-host';
import { ProductFactory } from '@business/product-management/product/domain/factories/product.factory';
import { Money } from '@business/shared-business/domain/common/value-objects/money';

// ---- Fakes ----

class InMemoryProductRepository extends ProductCommandRepository {
  public readonly saved: Product[] = [];
  public readonly existing: Map<string, Product> = new Map();

  async findById(id: string): Promise<Product | null> {
    return this.existing.get(id) ?? null;
  }
  async findBySku(sku: string): Promise<Product | null> {
    return [...this.existing.values()].find(p => p.sku === sku) ?? null;
  }
  async save(product: Product): Promise<Product> {
    this.saved.push(product);
    this.existing.set(product.id.toString(), product);
    return product;
  }
  async update(product: Product): Promise<Product> {
    return product;
  }
}

class InMemoryProductPublisherPort extends ProductPublisherPort {
  public readonly events: OutboxEvent[] = [];
  async send(event: OutboxEvent, _productId: string): Promise<void> {
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
    return { decision: 'DENY', reason: 'Denied' };
  }
}

// ---- Tests ----

describe('CreateProductUseCase (integration)', () => {
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

  function makeSut(opts?: { existingProduct?: Product; abacDeny?: boolean; noCompany?: boolean }) {
    const repo = new InMemoryProductRepository();
    if (opts?.existingProduct) {
      repo.existing.set(opts.existingProduct.id.toString(), opts.existingProduct);
    }
    const publisher = new InMemoryProductPublisherPort();
    const ctx = new InMemoryRequestContextService(
      opts?.noCompany ? { tenantId: 't', userId: 'u', roles: [] } : defaultContext,
    );
    const abac = opts?.abacDeny ? new DenyAbacAdapter() : new AllowAbacAdapter();
    const useCase = new CreateProductUseCase(repo, publisher, ctx, abac);
    return { useCase, repo, publisher, ctx };
  }

  it('creates a product and persists it with outbox event', async () => {
    const { useCase, repo, publisher } = makeSut();
    const id = await useCase.execute({
      sku: 'SKU-100',
      name: 'Wireless Mouse',
      unitPrice: 19.99,
      currency: 'USD',
    });
    expect(id).toBeTruthy();
    expect(repo.saved).toHaveLength(1);
    expect(repo.saved[0].sku).toBe('SKU-100');
    expect(repo.saved[0].name).toBe('Wireless Mouse');
    expect(repo.saved[0].unitPrice.minorUnits).toBe(1999);
    expect(publisher.events).toHaveLength(1);
  });

  it('creates product with default USD currency', async () => {
    const { useCase, repo } = makeSut();
    await useCase.execute({ sku: 'SKU-200', name: 'Keyboard', unitPrice: 89.5 });
    expect(repo.saved[0].currency).toBe('USD');
  });

  it('creates product with custom currency', async () => {
    const { useCase, repo } = makeSut();
    await useCase.execute({ sku: 'SKU-300', name: 'Monitor', unitPrice: 349, currency: 'EUR' });
    expect(repo.saved[0].currency).toBe('EUR');
  });

  it('throws NotFoundException when companyId is missing', async () => {
    const { useCase } = makeSut({ noCompany: true });
    await expect(useCase.execute({ sku: 'SKU-100', name: 'Mouse', unitPrice: 10 })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws ForbiddenException when ABAC denies', async () => {
    const { useCase } = makeSut({ abacDeny: true });
    await expect(useCase.execute({ sku: 'SKU-100', name: 'Mouse', unitPrice: 10 })).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('throws ConflictException when SKU already exists', async () => {
    const existing = ProductFactory.create({
      sku: 'SKU-100',
      name: 'Wireless Mouse',
      unitPrice: Money.fromMinorUnits(1999, 'USD'),
    });
    const { useCase } = makeSut({ existingProduct: existing });
    await expect(useCase.execute({ sku: 'SKU-100', name: 'Mouse', unitPrice: 10 })).rejects.toThrow(
      ConflictException,
    );
  });
});
