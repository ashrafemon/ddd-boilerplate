import { ProductCommandRepositoryPort } from '../../ports/outbound/product-command-repository.port';
import { InProcessEventBus } from '@business/shared-business/ports/event-bus.port';
import { OutboxWriterPort } from '@platform/outbox/ports/outbox-writer.port';
import {
  CompanyConfigPort,
  CompanyConfig,
} from '@platform/configuration/ports/company-config.port';
import { Product, ProductStatus } from '../../domain/entities/product.aggregate';
import { ProductId } from '../../domain/value-objects/product-id.vo';
import { Sku } from '../../domain/value-objects/sku.vo';
import { DomainEvent } from '@business/shared-business/domain/bases/event.base';
import { ConflictError } from '@business/shared-business/domain/domain.error';
import { CreateProductUseCase } from './create-product.usecase';

import { initNoopTransactionHost } from '@test/utils/noop-transaction-host';

class FakeProductCommandRepository implements ProductCommandRepositoryPort {
  items: Product[] = [];

  save(product: Product): Promise<Product> {
    this.items.push(product);
    return Promise.resolve(product);
  }

  update(product: Product): Promise<Product> {
    return Promise.resolve(product);
  }

  findById(id: ProductId): Promise<Product | null> {
    return Promise.resolve(this.items.find(p => p.id.equals(id)) ?? null);
  }

  findBySku(sku: Sku): Promise<Product | null> {
    return Promise.resolve(this.items.find(p => p.sku === sku.value) ?? null);
  }
}

class FakeEventBus implements InProcessEventBus {
  published: DomainEvent[] = [];
  publish(event: DomainEvent): void {
    this.published.push(event);
  }
  publishAll(events: readonly DomainEvent[]): void {
    this.published.push(...events);
  }
}

class FakeOutboxWriter implements OutboxWriterPort {
  written: { event: DomainEvent; aggregate: string }[] = [];

  append(event: DomainEvent, aggregateType: string): Promise<void> {
    this.written.push({ event, aggregate: aggregateType });
    return Promise.resolve();
  }
}

const fakeCompanyConfig: CompanyConfigPort = {
  getCompanyConfig: (): Promise<CompanyConfig> =>
    Promise.resolve({
      companyId: '00000000-0000-0000-0000-000000000000',
      companyCode: 'DEFAULT',
      companyName: 'erp-api',
      defaultCurrency: 'USD',
      autoApproveThreshold: 10_000,
      isActive: true,
    }),
};

describe('CreateProductUseCase', () => {
  let repository: FakeProductCommandRepository;
  let eventBus: FakeEventBus;
  let outbox: FakeOutboxWriter;
  let useCase: CreateProductUseCase;

  beforeAll(() => {
    initNoopTransactionHost();
  });

  beforeEach(() => {
    repository = new FakeProductCommandRepository();
    eventBus = new FakeEventBus();
    outbox = new FakeOutboxWriter();
    useCase = new CreateProductUseCase(repository, eventBus, outbox, fakeCompanyConfig);
  });

  it('creates a product, persists it and writes an outbox record', async () => {
    const id = await useCase.execute({
      sku: 'SKU-100',
      name: 'Keyboard',
      unitPrice: 29.99,
      currency: 'USD',
    });

    expect(id).toBeInstanceOf(ProductId);
    expect(repository.items).toHaveLength(1);
    expect(repository.items[0].status).toBe(ProductStatus.ACTIVE);
    expect(outbox.written).toHaveLength(1);
    expect(outbox.written[0].aggregate).toBe('Product');
    expect(eventBus.published).toHaveLength(1);
  });

  it('rejects a duplicate sku', async () => {
    await useCase.execute({ sku: 'SKU-100', name: 'A', unitPrice: 1 });
    await expect(
      useCase.execute({ sku: 'sku-100', name: 'B', unitPrice: 2 }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
