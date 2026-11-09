export abstract class StockBalanceQueryPort {
  abstract findBalance(
    productId: string,
    companyId?: string,
    tenantId?: string,
  ): Promise<{ productId: string; quantity: number } | null>;
}
