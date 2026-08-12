import { Identifier } from '../identifier';

/**
 * Base contract for aggregate/entity/value-object factories.
 *
 * Factories are the single sanctioned way to create and rehydrate domain
 * objects. They own construction, enforce creation invariants through the
 * invariant registry and raise creation domain events. Entity, aggregate and
 * value-object classes never construct each other directly.
 */
export abstract class DomainFactory<TAggregate, TInput, TProps = unknown> {
  abstract create(input: TInput): TAggregate;

  abstract reconstitute(id: Identifier, props: TProps, version: number): TAggregate;
}
