import { PriceListId } from '../value-objects/price-list-id.vo';
import { PriceListCode } from '../value-objects/price-list-code.vo';
import { PriceListStatus } from '../types/price-list.enum';

export interface PriceListProps {
  id: PriceListId;
  name: string;
  code: PriceListCode;
  currency: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  status: PriceListStatus;
  tenantId: string | null;
  companyId: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export interface PriceListLineProps {
  id: string;
  priceListId: string;
  productId: string;
  price: number;
  minQuantity: number;
  maxQuantity: number | null;
  tenantId: string | null;
  companyId: string;
}

export interface CustomerPriceProps {
  id: string;
  productId: string;
  price: number;
  currency: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  tenantId: string | null;
  companyId: string;
}

export interface PriceListState {
  status: PriceListStatus;
}

export interface CreatePriceListInput {
  name: string;
  code: string;
  currency: string;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
}

export interface UpdatePriceListInput {
  id: string;
  name?: string;
  code?: string;
  currency?: string;
  effectiveFrom?: Date | null;
  effectiveTo?: Date | null;
}

export interface AddPriceListLineInput {
  priceListId: string;
  productId: string;
  price: number;
  minQuantity: number;
  maxQuantity?: number | null;
}

export interface UpdatePriceListLineInput {
  priceListId: string;
  productId: string;
  price?: number;
  minQuantity?: number;
  maxQuantity?: number | null;
}

export interface RemovePriceListLineInput {
  priceListId: string;
  productId: string;
}

export interface ActivatePriceListInput {
  id: string;
}

export interface DeactivatePriceListInput {
  id: string;
}

export interface ArchivePriceListInput {
  id: string;
}

export interface GetProductPriceInput {
  productId: string;
  companyId?: string;
  tenantId?: string;
}

export interface PriceListQueryRecord {
  id: string;
  name: string;
  code: string;
  currency: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  status: string;
  tenantId: string | null;
  companyId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PriceListLineQueryRecord {
  id: string;
  priceListId: string;
  productId: string;
  price: number;
  minQuantity: number;
  maxQuantity: number | null;
  tenantId: string | null;
  companyId: string;
}

export interface CustomerPriceQueryRecord {
  id: string;
  productId: string;
  price: number;
  currency: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  tenantId: string | null;
  companyId: string;
}

export interface CreatePriceListRequest {
  name: string;
  code: string;
  currency: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
}

export interface UpdatePriceListRequest {
  id: string;
  name?: string;
  code?: string;
  currency?: string;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
}

export interface AddPriceListLineRequest {
  priceListId: string;
  productId: string;
  price: number;
  minQuantity: number;
  maxQuantity?: number | null;
}

export interface UpdatePriceListLineRequest {
  priceListId: string;
  productId: string;
  price?: number;
  minQuantity?: number;
  maxQuantity?: number | null;
}

export interface RemovePriceListLineRequest {
  priceListId: string;
  productId: string;
}

export interface ActivatePriceListRequest {
  id: string;
}

export interface DeactivatePriceListRequest {
  id: string;
}

export interface ArchivePriceListRequest {
  id: string;
}

export interface GetProductPriceRequest {
  productId: string;
}

export interface PriceListWithLines extends PriceListQueryRecord {
  lines: PriceListLineQueryRecord[];
}

export interface GetProductPriceResult {
  productId: string;
  price: number;
  currency: string;
  source: 'price-list-line' | 'customer-price';
}

export { PriceListStatus } from './price-list.enum';
