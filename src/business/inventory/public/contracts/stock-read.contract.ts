export interface StockReadReference {
  productId: string;
  companyId: string;
  tenantId: string | null;
  quantity: number;
  updatedAt: Date;
}
