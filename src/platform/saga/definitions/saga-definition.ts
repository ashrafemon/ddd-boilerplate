import { SagaDefinition } from '../saga.types';

/**
 * In-memory registry of saga definitions.
 * Business modules register their definitions at bootstrap.
 */
export class SagaDefinitionRegistry {
  private definitions = new Map<string, SagaDefinition>();

  register(definition: SagaDefinition): void {
    const key = `${definition.type}:v${definition.version}`;
    this.definitions.set(key, definition);
  }

  get(type: string, version: number): SagaDefinition | undefined {
    return this.definitions.get(`${type}:v${version}`);
  }

  has(type: string, version: number): boolean {
    return this.definitions.has(`${type}:v${version}`);
  }

  getAll(): SagaDefinition[] {
    return [...this.definitions.values()];
  }
}
