import {
  SagaActionContext,
  SagaActionResult,
  SagaUndoContext,
  SagaUndoResult,
} from '../saga.types';

/**
 * SagaAction — one command on one aggregate via its application service.
 *
 * Business modules register their own actions; SagaModule imports nothing from
 * business modules. The engine calls actions; it never touches repositories.
 */
export interface SagaAction {
  /** Action name as referenced from a definition (`inventory.valuateReceipt`). */
  readonly name: string;
  do(ctx: SagaActionContext): Promise<SagaActionResult>;
  /** Business reversal — idempotent, retried until ok. */
  undo(ctx: SagaUndoContext): Promise<SagaUndoResult>;
}

/** Multi-provider token: each module registers its own actions under it. */
export const SAGA_ACTION = 'SAGA_ACTION';
