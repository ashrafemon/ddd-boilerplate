import { Inject, Injectable } from '@nestjs/common';
import { ProductQueryPort, ProductSummary } from '../../ports/inbound/product.query.port';
import {
  PRODUCT_REPOSITORY,
  ProductRepositoryPort,
} from '../../ports/outbound/product-repository.port';
import { ProductId } from '../../domain/value-objects/product-id.vo';
import { PageQuery, PageResult, buildPageResult } from '@shared-kernel/types/pagination';
import { Product } from '../../domain/entities/product.aggregate';

function toSummary(product: Product): ProductSummary {
  return {
    id: product.id.toString(),
    sku: product.sku,
    name: product.name,
    description: product.description,
    status: product.status,
    unitPrice: product.unitPrice.amount,
    currency: product.currency,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

@Injectable()
export class ProductQueryService implements ProductQueryPort {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly productRepository: ProductRepositoryPort,
  ) {}

  async getProduct(id: ProductId): Promise<ProductSummary | null> {
    const product = await this.productRepository.findById(id);
    return product ? toSummary(product) : null;
  }

  async getPurchasableProduct(id: string): Promise<ProductSummary | null> {
    const product = await this.productRepository.findById(ProductId.fromString(id));
    if (!product || !product.isPurchasable()) {
      return null;
    }
    return toSummary(product);
  }

  async getPurchasableProducts(ids: string[]): Promise<ProductSummary[]> {
    const uniqueIds = [...new Set(ids)];
    const products = await Promise.all(
      uniqueIds.map(id => this.productRepository.findById(ProductId.fromString(id))),
    );
    return products
      .filter((product): product is Product => product !== null && product.isPurchasable())
      .map(toSummary);
  }

  async listProducts(query: PageQuery): Promise<PageResult<ProductSummary>> {
    const { items, total } = await this.productRepository.findAll(query);
    return buildPageResult(items.map(toSummary), total, query);
  }
}
