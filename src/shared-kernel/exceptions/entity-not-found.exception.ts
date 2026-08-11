import { DomainException } from './domain.exception';

export class EntityNotFoundException extends DomainException {
  constructor(entityName: string, id?: string | number, details?: Record<string, unknown>) {
    const suffix = id !== undefined ? ` [${String(id)}]` : '';
    super(`${entityName} not found${suffix}`, 'ENTITY_NOT_FOUND', { entityName, id, ...details });
    this.name = 'EntityNotFoundException';
  }
}
