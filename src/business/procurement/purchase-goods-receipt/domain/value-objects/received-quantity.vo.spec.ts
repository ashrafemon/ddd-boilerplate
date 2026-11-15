import { ReceivedQuantity } from './received-quantity.vo';

describe('ReceivedQuantity', () => {
  it('creates a positive quantity', () => {
    expect(ReceivedQuantity.create(5).value).toBe(5);
  });

  it('rejects zero or negative', () => {
    expect(() => ReceivedQuantity.create(0)).toThrow('Received quantity must be positive');
    expect(() => ReceivedQuantity.create(-2)).toThrow('Received quantity must be positive');
  });

  it('compares equality', () => {
    expect(ReceivedQuantity.create(1).equals(ReceivedQuantity.create(1))).toBe(true);
    expect(ReceivedQuantity.create(1).equals(ReceivedQuantity.create(2))).toBe(false);
    expect(ReceivedQuantity.create(1).equals(undefined)).toBe(false);
  });
});
