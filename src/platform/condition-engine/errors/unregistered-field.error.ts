import { DomainException } from '@shared-kernel/exceptions/domain.exception';

/**
 * Thrown when a GenerationCondition clause references a field with no
 * registered FieldResolver. This is a config/wiring error, not a business
 * no-op — callers must record it as a failure, never a "condition not met".
 */
export class UnregisteredFieldError extends DomainException {
  constructor(field: string) {
    super(`No FieldResolver registered for field '${field}'`, 'UNREGISTERED_FIELD', { field });
    this.name = 'UnregisteredFieldError';
  }
}
