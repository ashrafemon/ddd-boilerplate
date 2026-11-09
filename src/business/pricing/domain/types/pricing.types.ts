import { Money } from '@business/shared-business/domain/common/value-objects/money';
import { Quantity } from '@business/shared-business/domain/common/value-objects/quantity';

export interface PriceListProps {
  id: string;
  name: string;
  code: string;
  currency: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
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
  price: Money;
  minQuantity: Quantity;
  maxQuantity: Quantity | null;
  tenantId: string | null;
  companyId: string;
}

export interface CustomerPriceProps {
  id: string;
  productId: string;
  price: Money;
  currency: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  tenantId: string | null;
  companyId: string;
}

export enum PriceListStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}
