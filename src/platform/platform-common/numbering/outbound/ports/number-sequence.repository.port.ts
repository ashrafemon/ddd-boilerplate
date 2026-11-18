/**
 * Outbound port: one durable counter row per sequence key.
 *
 * `increment` is a single upsert-with-increment statement, which is what makes
 * the claim exclusive without a read-then-write window: two callers racing on a
 * brand-new key cannot both insert it, and the prefix/padding of an existing
 * series are never silently rewritten by a later caller.
 */
export abstract class NumberSequenceRepositoryPort {
  abstract increment(
    sequenceKey: string,
    defaults: { prefix: string; padding: number },
  ): Promise<{ prefix: string; padding: number; currentValue: bigint }>;
}
