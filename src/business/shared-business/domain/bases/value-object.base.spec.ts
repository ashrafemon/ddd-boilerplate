import { ValueObject } from './value-object.base';

class TestVo extends ValueObject<{ value: string }> {
  constructor(value: string) {
    super({ value });
  }

  get value(): string {
    return this.props.value;
  }
}

describe('ValueObject', () => {
  it('compares equal value objects as equal', () => {
    expect(new TestVo('same').equals(new TestVo('same'))).toBe(true);
  });

  it('compares different value objects as not equal', () => {
    expect(new TestVo('a').equals(new TestVo('b'))).toBe(false);
  });

  it('returns false when compared against undefined', () => {
    expect(new TestVo('a').equals(undefined)).toBe(false);
  });
});
