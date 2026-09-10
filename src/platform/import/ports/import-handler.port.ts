import {
  ImportContext,
  ImportDescriptor,
  PreloadedReferences,
  RowResult,
  RowVerdict,
} from '../import.types';

/**
 * The ONLY surface between the import pipeline and an import-capable aggregate.
 * Implemented once per entityKey (e.g. CustomerImportHandler), registered via
 * the owning domain module's `onApplicationBootstrap` registration.
 *
 * Three methods. A fourth usually means pipeline logic has leaked into the
 * domain (or vice versa) — stop and ask.
 */
export interface ImportHandler<TRow = unknown> {
  /** ONE query per reference type per chunk. Never per row (avoids N+1). */
  preloadReferences(rows: TRow[], ctx: ImportContext): Promise<PreloadedReferences>;

  /**
   * Domain validation only; structural validation already ran generically.
   * Returns a verdict PER ROW. Never aborts the whole job for one bad row.
   */
  validateBatch(rows: TRow[], refs: PreloadedReferences, ctx: ImportContext): Promise<RowVerdict[]>;

  /**
   * Claim → translate → domain service (ONE txn per row, owned by domain) → outcomes.
   */
  executeBatch(rows: TRow[], ctx: ImportContext): Promise<RowResult[]>;
}

/** What an entity module records against an entityKey. */
export interface ImportHandlerRegistration {
  entityKey: string;
  /** Descriptor data only — snapshotted onto jobs; no behaviour. */
  descriptor: ImportDescriptor;
}
