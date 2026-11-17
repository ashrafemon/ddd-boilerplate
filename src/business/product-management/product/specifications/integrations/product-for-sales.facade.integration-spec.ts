import { ProductForSalesFacade } from '@business/product-management/product/application/facades/product-for-sales.facade';
import { GetProductUseCase } from '@business/product-management/product/application/use-cases/get-product.usecase';
import { ProductQuery } from '@business/product-management/product/application/queries/product.query';
import { ProductQueryRecord } from '@business/product-management/product/domain/types/product.types';
import { ProductStatus } from '@business/product-management/product/domain/types/product.enum';
import { PageQuery, PageResult } from '@common/application/types/pagination';

function makeRecord(): ProductQueryRecord {
  return {
    id: 'p1',
    sku: 'SKU-1',
    name: 'Mouse',
    description: null,
    status: ProductStatus.ACTIVE,
    unitPrice: 1000,
    currency: 'USD',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

class InMemoryProductQuery extends ProductQuery {
  constructor(private readonly record: ProductQueryRecord | null) {
    super();
  }
  async findById(): Promise<ProductQueryRecord | null> {
    return this.record;
  }
  async findBySku(): Promise<ProductQueryRecord | null> {
    return null;
  }
  async findPurchasableById(): Promise<ProductQueryRecord | null> {
    return null;
  }
  async findPurchasableByIds(): Promise<ProductQueryRecord[]> {
    return [];
  }
  async findPurchasableBySkus(): Promise<ProductQueryRecord[]> {
    return [];
  }
  async findAll(query: PageQuery): Promise<PageResult<ProductQueryRecord>> {
    return { items: [], page: query.page, pageSize: query.pageSize, total: 0, totalPages: 0 };
  }
}

describe('ProductForSalesFacade (integration)', () => {
  it('maps a product to the sales contract', async () => {
    const facade = new ProductForSalesFacade(
      new GetProductUseCase(new InMemoryProductQuery(makeRecord())),
    );

    const result = await facade.getProductForSales('p1');
    expect(result).toMatchObject({ id: 'p1', sku: 'SKU-1', name: 'Mouse', status: 'ACTIVE' });
  });
});
