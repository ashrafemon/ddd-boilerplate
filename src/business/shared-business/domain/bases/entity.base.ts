export abstract class Entity<ID> {
  protected constructor(public readonly id: ID) {}
}
