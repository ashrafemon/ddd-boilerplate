export interface WorkflowStep<TContext> {
  name: string;
  execute(context: TContext): Promise<void> | void;
  compensate?(context: TContext): Promise<void> | void;
  when?(context: TContext): boolean;
}

/**
 * A named, ordered collection of steps that together implement a business
 * process (e.g. purchase-order approval → inventory reservation → accounting
 * entry → notification).
 *
 * Steps are orchestrations only: they reach other bounded contexts through
 * their application ports, never through their domain objects.
 */
export class WorkflowDefinition<TContext> {
  public readonly name: string;
  public readonly steps: WorkflowStep<TContext>[];

  constructor(name: string, steps: WorkflowStep<TContext>[]) {
    this.name = name;
    this.steps = steps;
  }
}
