/**
 * FeatureGate — opaque capability keys owned OUTSIDE the saga (the saga owns no
 * billing, plans or subscriptions). The router consults it to decide whether a
 * saga (or a step) exists for a company.
 */
export abstract class FeatureGate {
  /** Capability keys enabled for a company (e.g. `valuation`, `finance`). */
  abstract enabled(companyId: string): Promise<ReadonlySet<string>>;
}
