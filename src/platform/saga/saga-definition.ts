export interface SagaStep<TState> {
  name: string;
  invoke(state: TState): Promise<void> | void;
  compensate?(state: TState): Promise<void> | void;
  maxAttempts?: number;
  backoffMs?: number;
}

/**
 * A saga is a long-running, cross-module business process. Its steps are
 * executed with per-step retry; on failure the compensation of every
 * completed step runs in reverse order.
 */
export class SagaDefinition<TState> {
  public readonly name: string;
  public readonly steps: SagaStep<TState>[];

  constructor(name: string, steps: SagaStep<TState>[]) {
    this.name = name;
    this.steps = steps;
  }
}
