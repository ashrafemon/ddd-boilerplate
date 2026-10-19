import { GrnQueryRecord } from '../../domain/types/grn.types';

/**
 * Read-model cache seam for `get-grn` (plan §1.6 / E-9).
 *
 * Module-local outbound port because the capability carries module semantics
 * (namespace key + record date revival) — the platform `CachePort` itself
 * stays behind the adapter in `infrastructure/adapters/platform/`. Contract:
 * disposable, fail-open, Postgres always authoritative; every command use
 * case calls `invalidate(id)` after its save (documented pre-commit race: a
 * stale value can survive at most one TTL, never a corrupt one).
 */
export abstract class GrnReadCache {
  /** HIT returns the cached record; MISS/absent falls through to `load()`. */
  abstract getOrLoad(
    id: string,
    load: () => Promise<GrnQueryRecord | null>,
  ): Promise<GrnQueryRecord | null>;

  /** Drop the record after a successful command write. */
  abstract invalidate(id: string): Promise<void>;
}
