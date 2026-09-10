import { Injectable } from '@nestjs/common';
import { EvaluationContext, FieldResolver } from './ports/field-resolver.port';
import { UnregisteredFieldError } from './errors/unregistered-field.error';

/**
 * Keyed by field prefix (e.g. 'stock_balance' for 'stock_balance.qtyOnHand').
 * Field-owning modules register into this at bootstrap — ConditionEngineModule
 * never imports them. A duplicate prefix fails at boot; an unresolved prefix
 * fails at evaluation time (see UnregisteredFieldError).
 */
@Injectable()
export class FieldResolverRegistry {
  private readonly resolvers = new Map<string, FieldResolver>();

  register(prefix: string, resolver: FieldResolver): void {
    if (this.resolvers.has(prefix)) {
      throw new Error(`FieldResolver for '${prefix}' already registered`);
    }
    this.resolvers.set(prefix, resolver);
  }

  resolve(field: string, context: EvaluationContext): Promise<unknown> {
    const [prefix] = field.split('.');
    const resolver = this.resolvers.get(prefix);
    if (!resolver) {
      throw new UnregisteredFieldError(field);
    }
    return resolver.resolve(field, context);
  }
}
