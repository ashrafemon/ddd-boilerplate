import {
  SagaActionContext,
  SagaActionResult,
  SagaUndoContext,
  SagaUndoResult,
} from '../../types/saga.types';

/**
 * SagaAction — one command on one aggregate, executed through its application
 * service. Business modules own the implementations; the saga runtime only ever
 * sees this contract, so it imports no business module.
 */
export interface SagaAction {
  /** Action name as referenced from a definition (`inventory.valuateReceipt`). */
  readonly name: string;
  do(ctx: SagaActionContext): Promise<SagaActionResult>;
  /** Business reversal — idempotent, retried until `ok`. */
  undo(ctx: SagaUndoContext): Promise<SagaUndoResult>;
}

/** Multi-provider token: each business module registers its own actions under it. */
export const SAGA_ACTION = 'SAGA_ACTION';

/**
 * Outbound port: resolve a registered action by name.
 *
 * Implemented by `SagaActionRegistry`, which collects the `SAGA_ACTION`
 * providers at bootstrap. The step worker injects this port, never the registry.
 */
export abstract class SagaActionResolverPort {
  abstract resolve(name: string): SagaAction | null;
  abstract has(name: string): boolean;
}
