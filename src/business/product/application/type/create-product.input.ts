export interface CreateProductInput {
  code: string;
  name: string;
  description?: string;
  sku: string;
  unit: string;
  priceCents: number;
  currency: string;
  isPurchasable?: boolean;
  isSellable?: boolean;
  categoryId?: string;
}

export interface CreateProductOutput {
  productId: string;
}
