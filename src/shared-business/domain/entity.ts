import { Identifier } from './identifier';

/**
 * Base class for domain entities. Entities have identity (id) and mutable,
 * encapsulated state. State changes are only possible through explicit,
 * well-named methods.
 */
export abstract class Entity<TId extends Identifier> {
  protected readonly _id: TId;

  protected constructor(id: TId) {
    this._id = id;
  }

  public getId(): TId {
    return this._id;
  }

  public equals(other: Entity<TId> | null | undefined): boolean {
    return other != null && other.constructor === this.constructor && this._id.equals(other._id);
  }
}
