import { DomainFactory } from './factory.base';

class TestAggregate {
  constructor(
    public readonly id: string,
    public readonly value: string,
  ) {}
}

class TestFactory extends DomainFactory<TestAggregate, { value: string }, { value: string }> {
  create(input: { value: string }): TestAggregate {
    return new TestAggregate('generated-id', input.value);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  reconstitute(id: { value: string }, props: { value: string }, version: number): TestAggregate {
    return new TestAggregate(id.value, props.value);
  }
}

describe('DomainFactory', () => {
  const factory = new TestFactory();

  it('creates a new aggregate from input', () => {
    const aggregate = factory.create({ value: 'hello' });
    expect(aggregate.value).toBe('hello');
    expect(aggregate.id).toBe('generated-id');
  });

  it('reconstitutes an aggregate from persisted state', () => {
    const aggregate = factory.reconstitute({ value: 'id-1' }, { value: 'world' }, 3);
    expect(aggregate.id).toBe('id-1');
    expect(aggregate.value).toBe('world');
  });
});
