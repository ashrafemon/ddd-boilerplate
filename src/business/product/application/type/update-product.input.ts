export interface UpdateProductInput {
  productId: string;
  name?: string;
  description?: string;
  sku?: string;
  unit?: string;
  priceCents?: number;
  currency?: string;
  isPurchasable?: boolean;
  isSellable?: boolean;
  categoryId?: string;
}

export interface UpdateProductOutput {
  productId: string;
  updatedAt: Date;
}

export interface ActivateProductInput {
  productId: string;
}

export interface ActivateProductOutput {
  productId: string;
  status: 'ACTIVE';
}

export interface DeactivateProductInput {
  productId: string;
}

export interface DeactivateProductOutput {
  productId: string;
  status: 'INACTIVE';
}
