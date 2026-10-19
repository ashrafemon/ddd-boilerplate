/**
 * Module-local read cache for the good-receipt-note module.
 *
 * Cache lives in QUERY use cases only; COMMAND use cases never read it and
 * only invalidate the affected key after a successful write (see
 * `docs/PLATFORM-SERVICE-GUIDE.md` §7). The adapter behind this port is
 * fail-open: a cache outage degrades to the authoritative repository, never
 * to an error, and the module stays correct with the cache disabled.
 *
 * Key shape: `grn:<aggregateId>`.
 */
export abstract class ReadCachePort {
  /**
   * Return the cached value for `key`; on a miss, run `load` once and cache
   * its result. A cache failure falls through to `load`.
   */
  abstract getOrLoad<T>(key: string, load: () => Promise<T>): Promise<T>;

  /** Drop the cached value for `key`. A missing key counts as success. */
  abstract invalidate(key: string): Promise<void>;
}
