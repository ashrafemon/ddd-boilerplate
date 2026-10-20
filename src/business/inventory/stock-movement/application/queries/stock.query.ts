/**
 * Internal query port of the stock-movement module.
 *
 * The implementation reads the `stock_balances` projection through
 * `PrismaReadPort` (replica) and applies the tenant scope; the use cases
 * never touch Prisma themselves.
 */
export abstract class StockQuery {
  /**
   * On-hand quantity of `productId` inside `companyId`, or `null` when the
   * product never moved (the caller decides what "never moved" means).
   */
  abstract findBalance(productId: string, companyId: string): Promise<number | null>;
}
