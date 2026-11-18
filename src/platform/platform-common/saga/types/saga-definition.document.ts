/**
 * External saga definition document — the shape the workbook (`8-Saga` sheet and
 * the `saga_definitions` example row) uses to describe a saga.
 *
 * It is deliberately NOT the internal `SagaDefinitionBody`: the published
 * document names an `action`/`compensation` pair with explicit versions, spells
 * enums in upper case and carries an `acceptedEventCondition` for WAIT steps.
 * `parseSagaDefinition` normalises a document into the internal body, so business
 * modules author definitions in the documented format and the runtime keeps one
 * canonical representation.
 */

export interface SagaDocumentEventRef {
  name: string;
  version: number;
}

export interface SagaDocumentAction {
  name: string;
  version?: number;
}

export interface SagaDocumentStart {
  event: SagaDocumentEventRef;
  /** Correlation-key template over the trigger event, e.g. `GRN:{{event.grnId}}`. */
  key: string;
  /** Guard on the trigger event itself. */
  when?: string;
  /** prop name → expression over the trigger event. */
  context?: Record<string, string>;
}

export interface SagaDocumentStep {
  id: string;
  /** Explicit step kind; inferred when omitted (a `waitFor` makes it a WAIT). */
  kind?: string;
  policy?: string;
  /** What the step does on the happy path. */
  action?: SagaDocumentAction | string;
  /** Business reversal of `action` (a compensating document, never a delete). */
  compensation?: SagaDocumentAction | string;
  /** Internal alias for `action`. */
  do?: string;
  /** Internal alias for `compensation`. */
  undo?: string;
  /** input field → expression over earlier outputs. */
  input?: Record<string, string>;
  waitFor?: SagaDocumentEventRef;
  /** Correlation-key template the delivered event must match. */
  match?: string;
  /** Per-event filter for a WAIT step (workbook name). */
  when?: string;
  acceptedEventCondition?: string;
  requires?: string[];
  if?: string;
  /** ISO-8601 duration, e.g. `P7D`, `PT30M`. */
  timeout?: string;
  onTimeout?: string;
  /** Named retry profile, e.g. `standard`. */
  retryPolicy?: string;
  retry?: { maxAttempts: number };
  pivot?: boolean;
}

export interface SagaDefinitionDocument {
  key: string;
  version: number;
  requires?: string[];
  start: SagaDocumentStart;
  cancelOn?: SagaDocumentEventRef[];
  steps: SagaDocumentStep[];
  onComplete?: { emit: SagaDocumentEventRef | string };
}
