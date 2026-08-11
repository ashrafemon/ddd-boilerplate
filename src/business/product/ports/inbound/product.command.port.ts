import { ProductId } from '../../domain/value-objects/product-id.vo';
import { Money } from '@business/shared-business/domain/money.value-object';

export interface ProductCommandPort {
  createProduct(input: CreateProductInput): Promise<ProductId>;
  updateProduct(input: UpdateProductInput): Promise<ProductId>;
  changePrice(input: ChangePriceInput): Promise<ProductId>;
  activateProduct(id: string): Promise<ProductId>;
  deactivateProduct(id: string): Promise<ProductId>;
  discontinueProduct(id: string): Promise<ProductId>;
}

export interface CreateProductInput {
  sku: string;
  name: string;
  description?: string;
  unitPrice: number;
  currency?: string;
}

export interface UpdateProductInput {
  id: string;
  name?: string;
  description?: string;
}

export interface ChangePriceInput {
  id: string;
  unitPrice: number;
  currency?: string;
}

export const PRODUCT_COMMAND_PORT = Symbol('PRODUCT_COMMAND_PORT');

export { Money };
