import { GrnLine } from './grn-line.entity';

describe('GrnLine', () => {
  it('creates a line defaulting accepted to received', () => {
    const line = GrnLine.create('p1', 10, 8, 500);
    expect(line.acceptedQuantity).toBe(8);
    expect(line.rejectedQuantity).toBe(0);
    expect(line.tracking).toEqual([]);
  });

  it('computes total from received quantity and unit price', () => {
    expect(GrnLine.create('p1', 10, 8, 500).total).toBe(4000);
  });

  it('computes acceptedTotal and valuationAmount', () => {
    const line = GrnLine.create('p1', 10, 8, 500, 6, 2);
    expect(line.acceptedTotal).toBe(3000);
    expect(line.valuationAmount).toBe(3000);
  });

  it('withReceivedQuantity returns a new line preserving other fields', () => {
    const line = GrnLine.create('p1', 10, 8, 500, 6, 2);
    const updated = line.withReceivedQuantity(9);
    expect(updated.receivedQuantity).toBe(9);
    expect(updated.acceptedQuantity).toBe(6);
    expect(updated.unitPrice).toBe(500);
  });

  it('withTracking returns a new line with tracking', () => {
    const line = GrnLine.create('p1', 10, 8, 500);
    const updated = line.withTracking([{ quantity: 8, lotNo: 'L1' }]);
    expect(updated.tracking).toEqual([{ quantity: 8, lotNo: 'L1' }]);
  });

  it('withInspection splits accepted and rejected', () => {
    const line = GrnLine.create('p1', 10, 8, 500);
    const updated = line.withInspection(6, 2);
    expect(updated.acceptedQuantity).toBe(6);
    expect(updated.rejectedQuantity).toBe(2);
  });
});
