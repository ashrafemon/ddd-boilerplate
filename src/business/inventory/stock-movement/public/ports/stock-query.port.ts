/**
 * Inventory module's PUBLIC query contract (plan Phase 5.4) — the only path
 * other bounded contexts (sales, accounting, …) may use to read stock; the
 * ledger and balance tables stay internal (ESLint-enforced).
 *
 * Implemented by `StockQueryFacade` (`application/facades/`), which delegates
 * to the module's own query use case reading the `stock_balances` projection
 * through `PrismaReadPort`. Balances are derived from the authoritative
 * `inventory_movements` ledger (same-transaction projection), tenant-scoped
 * through `RequestContextPort`, and 0 for products that never moved.
 */
export abstract class StockQueryPort {
  /**
   * Current on-hand quantity for `productId` within `companyId`
   * (tenant-scoped by the ambient request context).
   */
  abstract getStockLevel(productId: string, companyId: string): Promise<number>;
}
