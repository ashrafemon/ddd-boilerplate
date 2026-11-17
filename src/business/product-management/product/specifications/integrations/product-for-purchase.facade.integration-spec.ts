import { ProductForPurchaseFacade } from '@business/product-management/product/application/facades/product-for-purchase.facade';
import { GetPurchasableProductUseCase } from '@business/product-management/product/application/use-cases/get-purchasable-product.usecase';
import { FindPurchasableProductsBySkusUseCase } from '@business/product-management/product/application/use-cases/find-purchasable-products-by-skus.usecase';
import { ProductQuery } from '@business/product-management/product/application/queries/product.query';
import { ProductQueryRecord } from '@business/product-management/product/domain/types/product.types';
import { ProductStatus } from '@business/product-management/product/domain/types/product.enum';
import { PageQuery, PageResult } from '@common/application/types/pagination';

function makeRecord(id: string, sku: string, status: ProductStatus): ProductQueryRecord {
  return {
    id,
    sku,
    name: `Product ${sku}`,
    description: null,
    status,
    unitPrice: 1000,
    currency: 'USD',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

class InMemoryProductQuery extends ProductQuery {
  constructor(private readonly records: ProductQueryRecord[]) {
    super();
  }
  async findById(id: string): Promise<ProductQueryRecord | null> {
    return this.records.find(r => r.id === id) ?? null;
  }
  async findBySku(sku: string): Promise<ProductQueryRecord | null> {
    return this.records.find(r => r.sku === sku) ?? null;
  }
  async findPurchasableById(id: string): Promise<ProductQueryRecord | null> {
    const r = this.records.find(r => r.id === id);
    return r && String(r.status) === String(ProductStatus.ACTIVE) ? r : null;
  }
  async findPurchasableByIds(ids: string[]): Promise<ProductQueryRecord[]> {
    return this.records.filter(
      r => ids.includes(r.id) && String(r.status) === String(ProductStatus.ACTIVE),
    );
  }
  async findPurchasableBySkus(skus: string[]): Promise<ProductQueryRecord[]> {
    return this.records.filter(
      r => skus.includes(r.sku) && String(r.status) === String(ProductStatus.ACTIVE),
    );
  }
  async findAll(query: PageQuery): Promise<PageResult<ProductQueryRecord>> {
    return { items: [], page: query.page, pageSize: query.pageSize, total: 0, totalPages: 0 };
  }
}

describe('ProductForPurchaseFacade (integration)', () => {
  const records = [
    makeRecord('p1', 'SKU-1', ProductStatus.ACTIVE),
    makeRecord('p2', 'SKU-2', ProductStatus.INACTIVE),
  ];
  const query = new InMemoryProductQuery(records);
  const facade = new ProductForPurchaseFacade(
    new GetPurchasableProductUseCase(query),
    new FindPurchasableProductsBySkusUseCase(query),
  );

  it('delegates getPurchasableProduct', async () => {
    await expect(facade.getPurchasableProduct('p1')).resolves.toMatchObject({ sku: 'SKU-1' });
    await expect(facade.getPurchasableProduct('p2')).resolves.toBeNull();
  });

  it('delegates findPurchasableProductsBySkus and filters non-active', async () => {
    const result = await facade.findPurchasableProductsBySkus(['SKU-1', 'SKU-2']);
    expect(result.map(r => r.sku)).toEqual(['SKU-1']);
  });
});
