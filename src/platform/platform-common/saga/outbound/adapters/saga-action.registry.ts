import { Inject, Injectable, Optional } from '@nestjs/common';
import { SAGA_ACTION, SagaAction, SagaActionResolverPort } from '../ports/saga-action.port';

/**
 * In-memory registry of `SAGA_ACTION` providers, implementing the resolver port.
 *
 * The platform never imports business modules: each module registers its own
 * actions under the `SAGA_ACTION` token and the composition root bridges them
 * here at bootstrap. Duplicates throw, so two modules cannot silently claim the
 * same action name.
 */
@Injectable()
export class SagaActionRegistry implements SagaActionResolverPort {
  private readonly actions = new Map<string, SagaAction>();

  constructor(@Optional() @Inject(SAGA_ACTION) provided: SagaAction[] | undefined) {
    for (const action of provided ?? []) {
      this.register(action);
    }
  }

  register(action: SagaAction): void {
    if (this.actions.has(action.name)) {
      throw new Error(`Duplicate saga action "${action.name}"`);
    }
    this.actions.set(action.name, action);
  }

  resolve(name: string): SagaAction | null {
    return this.actions.get(name) ?? null;
  }

  has(name: string): boolean {
    return this.actions.has(name);
  }
}
