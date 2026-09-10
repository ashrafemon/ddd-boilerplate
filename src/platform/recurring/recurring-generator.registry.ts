import { Injectable } from '@nestjs/common';
import { RecurringGenerator } from './ports/recurring-generator.port';
import {
  DuplicateGeneratorRegistrationError,
  UnregisteredGeneratorError,
} from './recurring.errors';

/**
 * Keyed by targetEntityType. Invisible outside RecurringModule —
 * SchedulerModule/ConditionEngineModule never see this map. Populated by
 * owning business modules' bootstrap registrations.
 */
@Injectable()
export class RecurringGeneratorRegistry {
  private readonly generators = new Map<string, RecurringGenerator>();

  register(targetEntityType: string, generator: RecurringGenerator): void {
    if (this.generators.has(targetEntityType)) {
      throw new DuplicateGeneratorRegistrationError(targetEntityType);
    }
    this.generators.set(targetEntityType, generator);
  }

  resolve(targetEntityType: string): RecurringGenerator {
    const generator = this.generators.get(targetEntityType);
    if (!generator) {
      throw new UnregisteredGeneratorError(targetEntityType);
    }
    return generator;
  }
}
