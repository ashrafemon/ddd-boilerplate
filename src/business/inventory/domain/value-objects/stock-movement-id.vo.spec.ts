import { StockMovementId } from './stock-movement-id.vo';

describe('StockMovementId', () => {
  it('wraps a string value', () => {
    expect(StockMovementId.fromString('sm-1').value).toBe('sm-1');
  });

  it('generates a UUID', () => {
    expect(StockMovementId.generate().value).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('stringifies to its value', () => {
    expect(StockMovementId.fromString('sm-1').toString()).toBe('sm-1');
  });
});
