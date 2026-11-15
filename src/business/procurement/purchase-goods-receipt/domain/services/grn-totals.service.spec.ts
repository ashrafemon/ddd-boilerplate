import { GrnTotalsService } from './grn-totals.service';

describe('GrnTotalsService', () => {
  it('sums line totals', () => {
    expect(GrnTotalsService.subtotal([{ total: 100 }, { total: 250 }])).toBe(350);
  });

  it('returns zero for no lines', () => {
    expect(GrnTotalsService.subtotal([])).toBe(0);
  });
});
