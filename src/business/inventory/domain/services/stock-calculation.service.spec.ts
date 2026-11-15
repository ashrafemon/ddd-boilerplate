import { StockCalculationService } from './stock-calculation.service';

describe('StockCalculationService', () => {
  it('adds a positive delta', () => {
    expect(StockCalculationService.add(10, 5)).toBe(15);
  });

  it('subtracts with a negative delta', () => {
    expect(StockCalculationService.add(10, -4)).toBe(6);
  });

  it('allows the balance to reach exactly zero', () => {
    expect(StockCalculationService.add(5, -5)).toBe(0);
  });

  it('rejects a negative resulting balance', () => {
    expect(() => StockCalculationService.add(3, -5)).toThrow('Stock balance cannot go negative');
  });
});
