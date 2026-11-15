import { Entity } from './entity.base';

class TestEntity extends Entity<string> {
  constructor(id: string) {
    super(id);
  }
}

class TestEntityWithNumberId extends Entity<number> {
  constructor(id: number) {
    super(id);
  }
}

describe('Entity', () => {
  it('exposes its identity', () => {
    const entity = new TestEntity('entity-1');
    expect(entity.id).toBe('entity-1');
  });

  it('supports non-string identities', () => {
    const entity = new TestEntityWithNumberId(42);
    expect(entity.id).toBe(42);
  });
});
