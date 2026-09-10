import { RecurringContext, ResolvedHeader } from '../recurring-context.types';

export interface RecurringGenerationResult {
  documentId: string;
  documentType: string;
  snapshot: Record<string, unknown>;
  /**
   * When true the generator enqueued work (outbox → broker). The handler
   * must not complete the execution or autoPost; the consumer does that.
   */
  deferred?: boolean;
}

/**
 * Optional in-process generator, registered on RecurringGeneratorRegistry by the
 * owning business module at bootstrap.
 * RecurringGenerationHandler does not call this: it writes
 * RecurringOccurrenceRequested to the outbox; business consumers create the document.
 */
export interface RecurringGenerator {
  resolveHeader(
    partyId: string,
    partyType: string,
    overrides: Record<string, unknown> | null,
    context: RecurringContext,
  ): Promise<ResolvedHeader>;

  generate(
    header: ResolvedHeader,
    lines: unknown[],
    context: RecurringContext,
  ): Promise<RecurringGenerationResult>;

  /**
   * Optional — implemented only by generators whose target aggregate has a
   * post/submit transition (doc Phase 7, autoPost). Failure here must never
   * re-run generation; the handler only logs it.
   */
  post?(documentId: string, context: RecurringContext): Promise<void>;
}
