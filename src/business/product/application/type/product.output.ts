export interface GetProductInput {
  productId: string;
}

export interface ProductOutput {
  id: string;
  tenantId: string;
  organizationId: string;
  code: string;
  name: string;
  description: string | null;
  sku: string;
  unit: string;
  status: string;
  isPurchasable: boolean;
  isSellable: boolean;
  priceCents: number;
  currency: string;
  categoryId: string | null;
}
