import { Inject, Injectable, Optional } from '@nestjs/common';
import { SAGA_ACTION, SagaAction } from '../ports/saga-action.port';

/**
 * Saga action registry — the platform never imports business modules; business
 * modules register their own `SagaAction` providers under the `SAGA_ACTION`
 * token (bridged by the composition root / their own module).
 */
@Injectable()
export class SagaActionRegistry {
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
