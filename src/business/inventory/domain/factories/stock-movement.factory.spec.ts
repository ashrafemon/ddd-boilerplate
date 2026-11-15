import { StockMovementFactory } from './stock-movement.factory';
import { StockMovementType } from '../types/stock-movement.enum';

const base = {
  grnLineId: 'grn-line-1',
  productId: 'product-1',
  quantity: 5,
  sourceDocumentId: 'grn-1',
  sourceDocumentType: 'GRN',
};

describe('StockMovementFactory', () => {
  it('records a receipt with defaults', () => {
    const movement = StockMovementFactory.record({ ...base, movementType: 'GOODS_RECEIPT' });
    expect(movement.movementType).toBe(StockMovementType.GOODS_RECEIPT);
    expect(movement.quantity).toBe(5);
    expect(movement.companyId).toBe('');
    expect(movement.tenantId).toBeNull();
    expect(movement.actorId).toBeNull();
    expect(movement.reversalOfId).toBeNull();
  });

  it('records a reversal and links the original document', () => {
    const movement = StockMovementFactory.record({
      ...base,
      movementType: 'GOODS_RECEIPT_REVERSAL',
    });
    expect(movement.movementType).toBe(StockMovementType.GOODS_RECEIPT_REVERSAL);
    expect(movement.reversalOfId).toBe('grn-1');
  });

  it('defaults any unknown type to GOODS_RECEIPT', () => {
    const movement = StockMovementFactory.record({ ...base, movementType: 'SOMETHING_ELSE' });
    expect(movement.movementType).toBe(StockMovementType.GOODS_RECEIPT);
  });

  it('uses the effectiveDate when supplied', () => {
    const effectiveDate = new Date('2026-05-01T00:00:00.000Z');
    const movement = StockMovementFactory.record({
      ...base,
      movementType: 'GOODS_RECEIPT',
      effectiveDate,
    });
    expect(movement.effectiveDate).toEqual(effectiveDate);
  });

  it('propagates company/tenant/actor', () => {
    const movement = StockMovementFactory.record({
      ...base,
      movementType: 'GOODS_RECEIPT',
      companyId: 'company-1',
      tenantId: 'tenant-1',
      actorId: 'user-1',
    });
    expect(movement.companyId).toBe('company-1');
    expect(movement.tenantId).toBe('tenant-1');
    expect(movement.actorId).toBe('user-1');
  });

  it('rejects a quantity below 1', () => {
    expect(() =>
      StockMovementFactory.record({ ...base, movementType: 'GOODS_RECEIPT', quantity: 0 }),
    ).toThrow('Stock movement quantity must be >= 1');
  });
});
