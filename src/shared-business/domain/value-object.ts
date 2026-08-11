import { deepEqual } from '../../shared-kernel/utilities/deep-equal';

/**
 * Base class for immutable value objects.
 *
 * Value objects are defined by their attributes and are immutable once
 * constructed. Subclasses expose static `from` factories that validate their
 * inputs (domain rules) before construction.
 */
export abstract class ValueObject<TProps extends object> {
  protected readonly props: Readonly<TProps>;

  protected constructor(props: TProps) {
    this.props = Object.freeze({ ...props });
  }

  public getProps(): Readonly<TProps> {
    return this.props;
  }

  public equals(other: ValueObject<TProps> | null | undefined): boolean {
    if (other == null) return false;
    if (other.constructor !== this.constructor) return false;
    return deepEqual(this.props, other.props);
  }

  public toJSON(): Readonly<TProps> {
    return this.props;
  }
}
