/**
 * Minimal, generic evaluation context. Deliberately structural rather than
 * importing anything from `platform/recurring` — RecurringContext (defined
 * there) satisfies this shape without ConditionEngineModule ever depending
 * on Recurring. Any future caller (approval workflows, discount eligibility)
 * can pass its own context type here the same way.
 */
export interface EvaluationContext {
  tenantId?: string;
  traceId: string;
  [key: string]: unknown;
}

/**
 * Resolves a dotted field (e.g. `stock_balance.qtyOnHand`) to its current
 * value. Implemented per domain table (InvoiceFieldResolver,
 * StockBalanceFieldResolver, ...) and registered into FieldResolverRegistry
 * by the module that owns the data — never by ConditionEngineModule itself.
 */
export interface FieldResolver {
  resolve(field: string, context: EvaluationContext): Promise<unknown>;
}
