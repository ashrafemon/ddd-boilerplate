import { NotFoundException } from '@nestjs/common';
import { GetProductUseCase } from '@business/product-management/product/application/use-cases/get-product.usecase';
import { ListProductsUseCase } from '@business/product-management/product/application/use-cases/list-products.usecase';
import { FindPurchasableProductsBySkusUseCase } from '@business/product-management/product/application/use-cases/find-purchasable-products-by-skus.usecase';
import { GetPurchasableProductUseCase } from '@business/product-management/product/application/use-cases/get-purchasable-product.usecase';
import { GetPurchasableProductsUseCase } from '@business/product-management/product/application/use-cases/get-purchasable-products.usecase';
import { ProductQuery } from '@business/product-management/product/application/queries/product.query';
import { ProductQueryRecord } from '@business/product-management/product/domain/types/product.types';
import { ProductStatus } from '@business/product-management/product/domain/types/product.enum';
import { PageQuery, PageResult } from '@common/application/types/pagination';

function makeRecord(overrides?: Partial<ProductQueryRecord>): ProductQueryRecord {
  return {
    id: 'p1',
    sku: 'SKU-1',
    name: 'Mouse',
    description: null,
    status: ProductStatus.ACTIVE,
    unitPrice: 1999,
    currency: 'USD',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

class InMemoryProductQuery extends ProductQuery {
  public readonly byId = new Map<string, ProductQueryRecord>();
  public readonly bySku = new Map<string, ProductQueryRecord>();

  async findById(id: string): Promise<ProductQueryRecord | null> {
    return this.byId.get(id) ?? null;
  }
  async findBySku(sku: string): Promise<ProductQueryRecord | null> {
    return this.bySku.get(sku) ?? null;
  }
  async findPurchasableById(id: string): Promise<ProductQueryRecord | null> {
    const r = this.byId.get(id);
    return r && String(r.status) === String(ProductStatus.ACTIVE) ? r : null;
  }
  async findPurchasableByIds(ids: string[]): Promise<ProductQueryRecord[]> {
    return ids
      .map(id => this.byId.get(id))
      .filter(
        (r): r is ProductQueryRecord => !!r && String(r.status) === String(ProductStatus.ACTIVE),
      );
  }
  async findPurchasableBySkus(skus: string[]): Promise<ProductQueryRecord[]> {
    return skus
      .map(sku => this.bySku.get(sku))
      .filter(
        (r): r is ProductQueryRecord => !!r && String(r.status) === String(ProductStatus.ACTIVE),
      );
  }
  async findAll(query: PageQuery): Promise<PageResult<ProductQueryRecord>> {
    const items = [...this.byId.values()];
    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      total: items.length,
      totalPages: 1,
    };
  }
}

describe('Product read-side use cases (integration)', () => {
  function makeQuery(): InMemoryProductQuery {
    const query = new InMemoryProductQuery();
    const active = makeRecord({ id: 'p1', sku: 'SKU-1' });
    const inactive = makeRecord({ id: 'p2', sku: 'SKU-2', status: ProductStatus.INACTIVE });
    query.byId.set('p1', active);
    query.byId.set('p2', inactive);
    query.bySku.set('SKU-1', active);
    query.bySku.set('SKU-2', inactive);
    return query;
  }

  it('GetProductUseCase returns the record', async () => {
    const useCase = new GetProductUseCase(makeQuery());
    const result = await useCase.execute('p1');
    expect(result.sku).toBe('SKU-1');
  });

  it('GetProductUseCase throws when missing', async () => {
    const useCase = new GetProductUseCase(makeQuery());
    await expect(useCase.execute('missing')).rejects.toThrow(NotFoundException);
  });

  it('ListProductsUseCase returns a page', async () => {
    const useCase = new ListProductsUseCase(makeQuery());
    const result = await useCase.execute({ page: 1, pageSize: 10 });
    expect(result.total).toBe(2);
    expect(result.items).toHaveLength(2);
  });

  it('FindPurchasableProductsBySkusUseCase filters non-active', async () => {
    const useCase = new FindPurchasableProductsBySkusUseCase(makeQuery());
    const result = await useCase.execute(['SKU-1', 'SKU-2']);
    expect(result.map(r => r.sku)).toEqual(['SKU-1']);
  });

  it('GetPurchasableProductUseCase returns only active', async () => {
    const useCase = new GetPurchasableProductUseCase(makeQuery());
    expect((await useCase.execute('p1'))?.sku).toBe('SKU-1');
    await expect(useCase.execute('p2')).resolves.toBeNull();
  });

  it('GetPurchasableProductsUseCase filters non-active by ids', async () => {
    const useCase = new GetPurchasableProductsUseCase(makeQuery());
    const result = await useCase.execute(['p1', 'p2']);
    expect(result.map(r => r.id)).toEqual(['p1']);
  });
});
