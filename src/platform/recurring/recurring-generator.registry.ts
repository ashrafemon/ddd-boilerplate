import { Injectable } from '@nestjs/common';
import { KeyedRegistryBase } from '@shared-kernel/utils/keyed-registry.base';
import { RecurringGenerator } from './ports/recurring-generator.port';

/**
 * Keyed by targetEntityType. Invisible outside RecurringModule —
 * SchedulerModule/ConditionEngineModule never see this map. Populated by
 * owning business modules' bootstrap registrations.
 */
@Injectable()
export class RecurringGeneratorRegistry extends KeyedRegistryBase<RecurringGenerator> {
  register(targetEntityType: string, generator: RecurringGenerator): void {
    this.registerEntry(
      targetEntityType,
      generator,
      () =>
        new Error(
          `RecurringGenerator for targetEntityType '${targetEntityType}' already registered`,
        ),
    );
  }

  resolve(targetEntityType: string): RecurringGenerator {
    return this.requireEntry(
      targetEntityType,
      () =>
        new Error(`No RecurringGenerator registered for targetEntityType '${targetEntityType}'`),
    );
  }
}
