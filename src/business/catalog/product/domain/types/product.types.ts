import { Money } from '@business/shared-business/domain/common/value-objects/money';
import { ProductName } from '../value-objects';
import { Sku } from '../value-objects';
import { ProductStatus } from './product.enum';
export { ProductStatus } from './product.enum';

export interface ProductProps {
  sku: Sku;
  name: ProductName;
  description: string | null;
  status: ProductStatus;
  unitPrice: Money;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProductInput {
  sku: string;
  name: string;
  description?: string;
  unitPrice: Money;
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

export type ProductStatusAction = 'activate' | 'deactivate' | 'discontinue';

export interface ProductStatusInput {
  id: string;
  action: ProductStatusAction;
}

export interface ProductState {
  status: ProductStatus;
}

export interface ProductQueryRecord {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  status: string;
  unitPrice: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProductRequest {
  sku: string;
  name: string;
  description?: string;
  unitPrice: number;
  currency?: string;
}

export interface UpdateProductRequest {
  id: string;
  name?: string;
  description?: string;
}

export interface ChangePriceRequest {
  id: string;
  unitPrice: number;
  currency?: string;
}

export interface ProductStatusRequest {
  id: string;
  action: ProductStatusAction;
}
