import { Injectable } from '@nestjs/common';
import { KeyedRegistryBase } from '@shared-kernel/utils/keyed-registry.base';
import { ConditionValue, EvaluationContext, FieldResolver } from './ports/field-resolver.port';

/**
 * Keyed by field prefix (e.g. 'stock_balance' for 'stock_balance.qtyOnHand').
 * Field-owning modules register into this at bootstrap — ConditionEngineModule
 * never imports them. A duplicate prefix fails at boot; an unresolved prefix
 * fails at evaluation time (see UnregisteredFieldError).
 */
@Injectable()
export class FieldResolverRegistry extends KeyedRegistryBase<FieldResolver> {
  register(prefix: string, resolver: FieldResolver): void {
    this.registerEntry(
      prefix,
      resolver,
      () => new Error(`FieldResolver for '${prefix}' already registered`),
    );
  }

  resolve(field: string, context: EvaluationContext): Promise<ConditionValue> {
    const [prefix] = field.split('.');
    const resolver = this.getEntry(prefix);
    if (!resolver) {
      throw new Error(`No FieldResolver registered for field '${field}'`);
    }
    return resolver.resolve(field, context);
  }
}
